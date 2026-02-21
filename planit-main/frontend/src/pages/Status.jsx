import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { uptimeAPI } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUTCDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    hour12: false,
  }).replace(',', '') + ' UTC';
}

function formatDayLabel(date) {
  // Use local date so the header matches the user's actual calendar day
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayKey(date) {
  // Use local date methods — toISOString() is always UTC which causes
  // off-by-one errors for users in timezones ahead of UTC
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Build 90-day bar data for a service from incidents
function buildBars(incidents, serviceName) {
  const days = 90;
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  // Map: YYYY-MM-DD -> 'ok' | 'degraded' | 'outage'
  const dayMap = {};

  incidents.forEach(inc => {
    const start = new Date(inc.createdAt);
    const end   = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
    const affects = !serviceName ||
      !inc.affectedServices?.length ||
      inc.affectedServices.some(s => s.toLowerCase().includes(serviceName.toLowerCase()) || serviceName.toLowerCase().includes(s.toLowerCase()));

    if (!affects) return;

    // Mark every day the incident spanned
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0); // local midnight
    const endMidnight = new Date(end);
    endMidnight.setHours(23, 59, 59, 999);
    while (cursor <= endMidnight) {
      const key = getDayKey(cursor);
      const existing = dayMap[key];
      const nextStatus = inc.severity === 'critical' ? 'outage' : 'degraded';
      if (!existing || (existing === 'degraded' && nextStatus === 'outage')) {
        dayMap[key] = nextStatus;
      }
      cursor.setDate(cursor.getDate() + 1); // local date increment
    }
  });

  const bars = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);   // local date arithmetic
    d.setHours(0, 0, 0, 0);
    bars.push({ date: new Date(d), status: dayMap[getDayKey(d)] || 'ok' });
  }
  return bars;
}

function uptimePct(bars) {
  const ok = bars.filter(b => b.status === 'ok').length;
  return ((ok / bars.length) * 100).toFixed(2);
}

// Group incidents by calendar date
function groupByDate(incidents) {
  const groups = {};
  incidents.forEach(inc => {
    const key = getDayKey(new Date(inc.createdAt));
    if (!groups[key]) groups[key] = [];
    groups[key].push(inc);
  });
  return groups;
}

// Generate date keys for the last 7 days using local time
function last7DayKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);  // local date arithmetic
    keys.push(getDayKey(d));
  }
  return keys;
}

const STATUS_LABEL = {
  investigating: 'Investigating',
  identified:    'Identified',
  monitoring:    'Monitoring',
  resolved:      'Resolved',
};

const SEVERITY_COLOR = {
  minor:    'text-amber-600',
  major:    'text-orange-600',
  critical: 'text-red-600',
};

const SERVICES = [
  { name: 'API',           key: 'api'           },
  { name: 'Database',      key: 'database'      },
  { name: 'File Storage',  key: 'storage'       },
  { name: 'WebSocket Chat',key: 'chat'          },
  { name: 'Authentication',key: 'auth'          },
];

// ─── Components ──────────────────────────────────────────────────────────────

function UptimeBar({ bar, index }) {
  const color =
    bar.status === 'outage'   ? '#ef4444' :
    bar.status === 'degraded' ? '#f97316' :
    '#22c55e';

  const title = `${formatDayLabel(bar.date)} — ${
    bar.status === 'ok' ? 'No incidents' :
    bar.status === 'degraded' ? 'Degraded' : 'Outage'
  }`;

  return (
    <div
      title={title}
      style={{
        width: '100%',
        height: '36px',
        backgroundColor: color,
        borderRadius: '2px',
        cursor: 'default',
        opacity: 0,
        animation: `barIn 0.3s ease ${index * 0.008}s both`,
        flexShrink: 0,
      }}
    />
  );
}

function ServiceRow({ service, incidents, online }) {
  const bars = buildBars(incidents, service.key);
  const pct  = uptimePct(bars);

  const hasActive = incidents.some(inc =>
    inc.status !== 'resolved' &&
    (!inc.affectedServices?.length ||
      inc.affectedServices.some(s =>
        s.toLowerCase().includes(service.key.toLowerCase()) ||
        service.key.toLowerCase().includes(s.toLowerCase())
      ))
  );

  const isOperational = online && !hasActive;

  return (
    <div style={{ padding: '20px 0', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '15px', fontWeight: '500', color: '#111827', fontFamily: '"DM Sans", sans-serif' }}>
          {service.name}
        </span>
        <span style={{ fontSize: '14px', fontWeight: '500', color: isOperational ? '#16a34a' : '#f97316', fontFamily: '"DM Sans", sans-serif' }}>
          {isOperational ? 'Operational' : 'Disrupted'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '2px', width: '100%', overflow: 'hidden' }}>
        {bars.map((bar, i) => (
          <UptimeBar key={i} bar={bar} index={i} />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>90 days ago</span>
        <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>
          {pct}% uptime
        </span>
        <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>Today</span>
      </div>
    </div>
  );
}

function IncidentTimeline({ incident }) {
  const [expanded, setExpanded] = useState(true);
  const titleColor = SEVERITY_COLOR[incident.severity] || 'text-amber-600';

  return (
    <div style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          textAlign: 'left', width: '100%',
        }}
      >
        <span style={{
          fontSize: '15px', fontWeight: '600',
          color: incident.severity === 'critical' ? '#dc2626' :
                 incident.severity === 'major'    ? '#ea580c' : '#d97706',
          fontFamily: '"DM Sans", sans-serif',
          textDecoration: 'none',
        }}>
          {incident.title}
        </span>
      </button>

      {expanded && incident.timeline && [...incident.timeline].reverse().map((update, i) => (
        <div key={i} style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '14px', color: '#111827', lineHeight: '1.6', fontFamily: '"DM Sans", sans-serif', margin: 0 }}>
            <strong style={{ fontWeight: '700' }}>{STATUS_LABEL[update.status] || update.status}</strong>
            {' - '}{update.message}
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', fontFamily: '"DM Sans", sans-serif' }}>
            {formatUTCDate(update.createdAt)}
          </p>
        </div>
      ))}

      {!incident.timeline?.length && (
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', fontFamily: '"DM Sans", sans-serif' }}>
          <strong>Investigating</strong> - We are currently investigating this issue.
        </p>
      )}
    </div>
  );
}

function ReportModal({ onClose, onSubmit, submitting, success }) {
  const [form, setForm] = useState({ description: '', email: '', affectedService: 'General' });
  const SERVICES_LIST = ['General', 'API', 'Database', 'File Storage', 'WebSocket Chat', 'Authentication'];

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (success) return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '40px',
        textAlign: 'center', maxWidth: '360px', width: '90%',
        animation: 'modalIn 0.25s ease both',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827', fontFamily: '"DM Sans", sans-serif' }}>
          Report received
        </p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px', fontFamily: '"DM Sans", sans-serif' }}>
          Thank you for helping us improve reliability.
        </p>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '460px',
        overflow: 'hidden', animation: 'modalIn 0.2s ease both',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#111827', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>
            Report an issue
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px', fontFamily: '"DM Sans", sans-serif' }}>
            Help us identify problems faster
          </p>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', fontFamily: '"DM Sans", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Affected area
            </label>
            <select
              value={form.affectedService}
              onChange={e => setForm(f => ({ ...f, affectedService: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#f9fafb', outline: 'none', fontFamily: '"DM Sans", sans-serif' }}
            >
              {SERVICES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', fontFamily: '"DM Sans", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', fontFamily: '"DM Sans", sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || form.description.trim().length < 5}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              background: form.description.trim().length < 5 ? '#e5e7eb' : '#111827',
              color: form.description.trim().length < 5 ? '#9ca3af' : '#fff',
              fontSize: '14px', fontWeight: '600', cursor: form.description.trim().length < 5 ? 'default' : 'pointer',
              fontFamily: '"DM Sans", sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {submitting ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : null}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Status() {
  const [data, setData]           = useState(null);
  const [online, setOnline]       = useState(true);
  const [latency, setLatency]     = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]     = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await uptimeAPI.getStatus();
      setData(res.data);
    } catch { /* keep stale */ }
  }, []);

  const ping = useCallback(async () => {
    const t = Date.now();
    try {
      await uptimeAPI.ping();
      setLatency(Date.now() - t);
      setOnline(true);
    } catch {
      setOnline(false);
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    ping();
    const si = setInterval(fetchStatus, 30000);
    const pi = setInterval(ping, 15000);
    return () => { clearInterval(si); clearInterval(pi); };
  }, [fetchStatus, ping]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      await uptimeAPI.submitReport(form);
      setSuccess(true);
      setTimeout(() => { setShowReport(false); setSuccess(false); }, 2200);
    } catch { /* keep open */ }
    finally { setSubmitting(false); }
  };

  const allIncidents = [
    ...(data?.activeIncidents  || []),
    ...(data?.recentResolved   || []),
  ];

  const overallStatus = data?.status || (online ? 'operational' : 'outage');
  const activeCount = data?.activeIncidents?.length || 0;

  // Build past-incidents grouped by date
  const incidentsByDay = groupByDate(allIncidents);
  const dayKeys = last7DayKeys();

  // Total uptime display
  const allBars = buildBars(allIncidents, '');
  const totalPct = uptimePct(allBars);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes barIn   { from { opacity:0; transform:scaleY(0.4); } to { opacity:1; transform:scaleY(1); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.97) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '"DM Sans", sans-serif' }}>

        {/* Header */}
        <header style={{
          background: '#fff', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ← PlanIt
            </Link>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>
              System Status
            </span>
            <button
              onClick={() => setShowReport(true)}
              style={{
                padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: '6px',
                background: '#fff', color: '#374151', fontSize: '13px', fontWeight: '500',
                cursor: 'pointer', fontFamily: '"DM Sans", sans-serif',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.target.style.background = '#f9fafb'}
              onMouseLeave={e => e.target.style.background = '#fff'}
            >
              Report issue
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 80px' }}>

          {/* Overall status banner */}
          <div style={{
            margin: '40px 0 32px',
            padding: '24px 28px',
            border: `1px solid ${activeCount > 0 ? '#fed7aa' : '#bbf7d0'}`,
            borderRadius: '12px',
            background: activeCount > 0 ? '#fff7ed' : '#f0fdf4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            animation: 'fadeIn 0.4s ease both',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: activeCount > 0 ? '#f97316' : '#22c55e',
                animation: activeCount > 0 ? 'pulse 2s infinite' : 'none',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                {activeCount > 0 ? `${activeCount} Active Incident${activeCount > 1 ? 's' : ''}` : 'All Systems Operational'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                {totalPct}% uptime (90 days)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: online ? '#16a34a' : '#dc2626' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                {latency !== null ? `${latency}ms` : online ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Active incidents alert */}
          {data?.activeIncidents?.map(inc => (
            <div key={inc._id} style={{
              border: `1px solid ${inc.severity === 'critical' ? '#fecaca' : '#fed7aa'}`,
              borderLeft: `4px solid ${inc.severity === 'critical' ? '#ef4444' : '#f97316'}`,
              borderRadius: '8px',
              background: inc.severity === 'critical' ? '#fef2f2' : '#fff7ed',
              padding: '16px 20px',
              marginBottom: '16px',
              animation: 'fadeIn 0.3s ease both',
            }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: inc.severity === 'critical' ? '#dc2626' : '#ea580c', margin: '0 0 4px', fontFamily: '"DM Sans", sans-serif' }}>
                {inc.title}
              </p>
              {inc.timeline?.length > 0 && (
                <>
                  <p style={{ fontSize: '13px', color: '#374151', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>
                    <strong>{STATUS_LABEL[inc.timeline[inc.timeline.length - 1].status]}</strong>
                    {' - '}{inc.timeline[inc.timeline.length - 1].message}
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0', fontFamily: '"DM Sans", sans-serif' }}>
                    {formatUTCDate(inc.timeline[inc.timeline.length - 1].createdAt)}
                  </p>
                </>
              )}
            </div>
          ))}

          {/* Services uptime section */}
          <section style={{ animation: 'fadeIn 0.4s ease 0.1s both' }}>
            <h2 style={{ fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>
              Uptime over the past 90 days
            </h2>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0 24px', overflow: 'hidden' }}>
              {SERVICES.map((svc, i) => (
                <ServiceRow
                  key={svc.key}
                  service={svc}
                  incidents={allIncidents}
                  online={online}
                />
              ))}
            </div>
          </section>

          {/* Past Incidents */}
          <section style={{ marginTop: '48px', animation: 'fadeIn 0.4s ease 0.2s both' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 24px' }}>
              Past Incidents
            </h2>

            {dayKeys.map(dayKey => {
            const [y, mo, d] = dayKey.split('-').map(Number);
              const dayDate = new Date(y, mo - 1, d); // local date constructor
              const label = formatDayLabel(dayDate);
              const dayIncidents = incidentsByDay[dayKey] || [];

              return (
                <div key={dayKey} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                  </div>

                  {dayIncidents.length === 0 ? (
                    <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0', fontFamily: '"DM Sans", sans-serif' }}>
                      No incidents reported.
                    </p>
                  ) : dayIncidents.map(inc => (
                    <IncidentTimeline key={inc._id} incident={inc} />
                  ))}
                </div>
              );
            })}

            {allIncidents.length === 0 && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                No incidents in the past 7 days.
              </p>
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