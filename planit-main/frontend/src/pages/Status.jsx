import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { uptimeAPI } from '../services/api';
import { SERVICE_CATEGORIES, ALL_SERVICES_FLAT } from '../utils/serviceCategories';

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

/**
 * Build 90-day uptime bars from incident history.
 * Days with no incident are green. serverDown marks today red immediately,
 * before the watchdog has a chance to write an incident to the DB.
 */
function buildBars(incidents, serviceKey, serverDown = false) {
  const DAYS = 15;
  const dayMap = {};

  if (serverDown) {
    dayMap[getDayKey(new Date())] = 'outage';
  }

  incidents.forEach(inc => {
    const start = new Date(inc.createdAt);
    const end   = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();

    const affects =
      !serviceKey ||
      !inc.affectedServices?.length ||
      inc.affectedServices.some(s =>
        s.toLowerCase().includes(serviceKey.toLowerCase()) ||
        serviceKey.toLowerCase().includes(s.toLowerCase())
      );
    if (!affects) return;

    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);

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
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    bars.push({ date: new Date(d), status: dayMap[getDayKey(d)] || 'ok' });
  }
  return bars;
}

function uptimePct(bars) {
  const ok = bars.filter(b => b.status === 'ok').length;
  return ((ok / bars.length) * 100).toFixed(2);
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
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(getDayKey(d));
  }
  return keys;
}

/**
 * A service is disrupted if the server is offline OR there's an active incident
 * for it. Both conditions are checked — they were previously inconsistent.
 */
function isServiceDisrupted(serviceKey, incidents, online) {
  if (!online) return true;
  return incidents.some(
    inc =>
      inc.status !== 'resolved' &&
      (!inc.affectedServices?.length ||
        inc.affectedServices.some(s =>
          s.toLowerCase().includes(serviceKey.toLowerCase()) ||
          serviceKey.toLowerCase().includes(s.toLowerCase())
        ))
  );
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
    bar.status === 'degraded' ? '#f97316' : '#22c55e';

  const label =
    bar.status === 'outage'   ? 'Outage' :
    bar.status === 'degraded' ? 'Degraded' : 'Operational';

  return (
    <div
      title={`${formatDayLabel(bar.date)} — ${label}`}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        height: '44px',
        backgroundColor: color,
        borderRadius: '999px',
        cursor: 'default',
        flexShrink: 0,
        opacity: 0,
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
      <div style={{ display: 'flex', gap: '6px', width: '100%', overflow: 'hidden' }}>
        {bars.map((bar, i) => <UptimeBar key={i} bar={bar} index={i} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>15 days ago</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>{pct}% uptime</span>
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
  const [data, setData]                 = useState(null);
  const [online, setOnline]             = useState(true);
  const [latency, setLatency]           = useState(null);
  const [showReport, setShowReport]     = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [success, setSuccess]           = useState(false);
  const [autoReported, setAutoReported] = useState(false);
  const [lastFetch, setLastFetch]       = useState(null);

  const pingFailsRef    = useRef(0);
  const lastAutoReport  = useRef(0);
  const onlineRef       = useRef(true); // ref so ping callback can read latest value
  const statusTimerRef  = useRef(null);
  const pingTimerRef    = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await uptimeAPI.getStatus();
      setData(res.data);
      setLastFetch(new Date());
    } catch {
      // Keep stale — the ping loop controls online/offline state
    }
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

      // Immediately refresh status data when coming back online
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
        // Best-effort — will fail if server is completely dead, but the
        // watchdog is the reliable path for writing the DB incident.
        uptimeAPI.submitReport({
          description:     `[AUTO] Status page detected ${AUTO_REPORT_FAILURES} consecutive API ping failures. Backend appears unreachable.`,
          email:           '',
          affectedService: 'API',
        }).catch(() => {});
      }
    }
  }, [fetchStatus]);

  // Re-schedule intervals whenever online state changes so we use
  // fast (5s) polling while offline and normal (15s) when online.
  useEffect(() => {
    if (statusTimerRef.current) clearInterval(statusTimerRef.current);
    if (pingTimerRef.current)   clearInterval(pingTimerRef.current);

    fetchStatus();
    ping();

    statusTimerRef.current = setInterval(fetchStatus, 30_000);
    pingTimerRef.current   = setInterval(ping, online ? 15_000 : 5_000);

    return () => {
      clearInterval(statusTimerRef.current);
      clearInterval(pingTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      await uptimeAPI.submitReport(form);
      setSuccess(true);
      setTimeout(() => { setShowReport(false); setSuccess(false); }, 2200);
    } catch {
      // Keep modal open
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const allIncidents    = [...(data?.activeIncidents || []), ...(data?.recentResolved || [])];
  const activeIncidents = data?.activeIncidents || [];

  // Banner state: offline beats incident beats operational
  const bannerState =
    !online                    ? 'offline'     :
    activeIncidents.length > 0 ? 'incident'    : 'operational';

  const BANNER = {
    offline:     { bg: '#fef2f2', border: '#fecaca', iconFill: '#ef4444', title: 'Service Unavailable',   sub: 'We cannot reach the PlanIt servers. All services may be affected.' },
    incident:    { bg: '#fff7ed', border: '#fed7aa', iconFill: '#f97316', title: `${activeIncidents.length} Active Incident${activeIncidents.length !== 1 ? 's' : ''}`, sub: 'We are aware of issues affecting some services.' },
    operational: { bg: '#f0fdf4', border: '#bbf7d0', iconFill: '#22c55e', title: 'All Systems Operational', sub: "We're not aware of any issues affecting our systems." },
  }[bannerState];

  // Overall uptime — serverDown=true so today's bar is red when offline
  const allBars  = buildBars(allIncidents, '', !online);
  const totalPct = uptimePct(allBars);

  const incidentsByDay = groupByDate(allIncidents);
  const dayKeys        = last7DayKeys();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes barIn    { from { opacity:0; transform:scaleY(0.4); } to { opacity:1; transform:scaleY(1); } }
        @keyframes fadeIn   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes expandIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn  { from { opacity:0; transform:scale(0.97) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin     { to { transform:rotate(360deg); } }
        @keyframes pulse    { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        * { box-sizing:border-box; }
        body { margin:0; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '"DM Sans", sans-serif' }}>

        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px 80px' }}>

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
              <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>{totalPct}% uptime (15d)</span>
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

          {/* System status categories */}
          <section style={{ animation: 'fadeIn 0.4s ease 0.1s both' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>System Status</h2>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              {SERVICE_CATEGORIES.map((cat, i) => (
                <CategorySection key={cat.id} category={cat} incidents={allIncidents} online={online} defaultOpen={i === 0} />
              ))}
            </div>
          </section>

          {/* Past incidents */}
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