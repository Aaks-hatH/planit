import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, Clock, ChevronDown, ChevronUp, ArrowLeft, Wifi, WifiOff, Send, X } from 'lucide-react';
import { uptimeAPI } from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_BASE = API_URL.replace('/api', '');

const SEVERITY_COLORS = {
  minor:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  major:    { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500'     },
};

const STATUS_LABEL = {
  investigating: 'Investigating',
  identified:    'Identified',
  monitoring:    'Monitoring',
  resolved:      'Resolved',
};

const STATUS_DOT = {
  investigating: 'bg-red-500',
  identified:    'bg-orange-400',
  monitoring:    'bg-amber-400',
  resolved:      'bg-emerald-500',
};

function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function IncidentCard({ incident }) {
  const [expanded, setExpanded] = useState(incident.status !== 'resolved');
  const s = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.minor;

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden transition-all duration-300`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:brightness-[0.98] transition-all"
      >
        <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${s.dot} ${incident.status !== 'resolved' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold ${s.text}`}>{incident.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${s.border} ${s.text} bg-white/60`}>
              {incident.severity}
            </span>
            {incident.resolvedAt && incident.downtimeMinutes && (
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatDuration(incident.downtimeMinutes)}
              </span>
            )}
          </div>
          {incident.affectedServices?.length > 0 && (
            <p className="text-xs text-neutral-500 mt-0.5">
              Affects: {incident.affectedServices.join(', ')}
            </p>
          )}
          <p className="text-xs text-neutral-400 mt-0.5">{timeAgo(incident.createdAt)}</p>
        </div>
        <span className={`${s.text} flex-shrink-0`}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && incident.timeline?.length > 0 && (
        <div className="px-5 pb-5 border-t border-neutral-100/80">
          <div className="relative mt-4 pl-4">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-neutral-200" />
            {[...incident.timeline].reverse().map((update, i) => (
              <div
                key={i}
                className="relative mb-4 last:mb-0"
                style={{ animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}
              >
                <span className={`absolute -left-[17px] w-2.5 h-2.5 rounded-full border-2 border-white ${STATUS_DOT[update.status] || 'bg-neutral-400'}`} />
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-neutral-700">{STATUS_LABEL[update.status]}</span>
                  <span className="text-xs text-neutral-400">{timeAgo(update.createdAt)}</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">{update.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ description: '', email: '', affectedService: 'General' });

  const services = ['General', 'Event Creation', 'Chat', 'File Upload', 'Check-in', 'Authentication'];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-neutral-100">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Report an Issue</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Help us identify problems faster</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">What's affected?</label>
            <select
              value={form.affectedService}
              onChange={e => setForm(f => ({ ...f, affectedService: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
            >
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description <span className="text-red-400">*</span></label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what you're experiencing..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email <span className="text-neutral-400">(optional)</span></label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-all"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || form.description.trim().length < 5}
            className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Send className="w-3.5 h-3.5" /> Submit Report</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Status() {
  const [data, setData] = useState(null);
  const [latency, setLatency] = useState(null);
  const [online, setOnline] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const ping = useCallback(async () => {
    const start = Date.now();
    try {
      await uptimeAPI.ping();
      setLatency(Date.now() - start);
      setOnline(true);
    } catch {
      setOnline(false);
      setLatency(null);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await uptimeAPI.getStatus();
      setData(res.data);
      setLastChecked(new Date());
    } catch {
      // keep stale data
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    ping();
    const statusInterval = setInterval(fetchStatus, 30000);
    const pingInterval = setInterval(ping, 15000);
    return () => { clearInterval(statusInterval); clearInterval(pingInterval); };
  }, [fetchStatus, ping]);

  const handleSubmitReport = async (form) => {
    setReportSubmitting(true);
    try {
      await uptimeAPI.submitReport(form);
      setReportSuccess(true);
      setTimeout(() => {
        setShowReport(false);
        setReportSuccess(false);
      }, 2000);
    } catch {
      // keep modal open
    } finally {
      setReportSubmitting(false);
    }
  };

  const overallStatus = data?.status || 'operational';

  const statusConfig = {
    operational: {
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
      label: 'All Systems Operational',
    },
    degraded: {
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
      label: 'Partial Degradation',
    },
    outage: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      dot: 'bg-red-500',
      label: 'Service Disruption',
    },
  };

  const sc = statusConfig[overallStatus];
  const StatusIcon = sc.icon;

  return (
    <div className="min-h-screen bg-neutral-50">
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { opacity: 0.4; }
          50%  { opacity: 1;   }
          100% { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-700 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            PlanIt
          </Link>
          <span className="text-sm font-semibold text-neutral-900">Status</span>
          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            {latency !== null && (
              <span className="text-xs text-neutral-400 font-mono">{latency}ms</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* Hero status card */}
        <div className={`rounded-2xl border ${sc.border} ${sc.bg} px-6 py-8 flex flex-col items-center text-center`}
          style={{ animation: 'fadeSlideIn 0.4s ease both' }}>
          <div className="relative mb-4">
            <span className={`w-3.5 h-3.5 rounded-full ${sc.dot} block ${overallStatus !== 'operational' ? 'animate-pulse' : ''}`} />
          </div>
          <StatusIcon className={`w-10 h-10 ${sc.color} mb-3`} />
          <h1 className={`text-xl font-bold ${sc.color}`}>{sc.label}</h1>
          {lastChecked && (
            <p className="text-xs text-neutral-400 mt-2">
              Last checked {timeAgo(lastChecked)}
              {data?.uptimeSeconds && ` · Server up ${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor((data.uptimeSeconds % 3600) / 60)}m`}
            </p>
          )}
        </div>

        {/* Services */}
        <div style={{ animation: 'fadeSlideIn 0.4s ease 0.1s both' }}>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Services</h2>
          <div className="bg-white rounded-2xl border border-neutral-100 divide-y divide-neutral-50 overflow-hidden">
            {[
              { name: 'API', key: 'api' },
              { name: 'Database', key: 'db' },
              { name: 'File Storage', key: 'storage' },
              { name: 'WebSocket Chat', key: 'chat' },
            ].map(({ name, key }) => {
              const hasIncident = data?.activeIncidents?.some(i =>
                i.affectedServices?.some(s => s.toLowerCase().includes(name.toLowerCase()))
              );
              const isOk = !hasIncident && online && (key !== 'db' || data?.dbStatus === 'connected');
              return (
                <div key={key} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-neutral-700">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className={`text-xs font-medium ${isOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {isOk ? 'Operational' : 'Disrupted'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active incidents */}
        {data?.activeIncidents?.length > 0 && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease 0.15s both' }}>
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Active Incidents
            </h2>
            <div className="space-y-3">
              {data.activeIncidents.map(incident => (
                <IncidentCard key={incident._id} incident={incident} />
              ))}
            </div>
          </div>
        )}

        {/* Recent resolved */}
        {data?.recentResolved?.length > 0 && (
          <div style={{ animation: 'fadeSlideIn 0.4s ease 0.2s both' }}>
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              Recent History
            </h2>
            <div className="space-y-2">
              {data.recentResolved.map(incident => (
                <IncidentCard key={incident._id} incident={incident} />
              ))}
            </div>
          </div>
        )}

        {data?.activeIncidents?.length === 0 && data?.recentResolved?.length === 0 && (
          <div className="text-center py-8" style={{ animation: 'fadeSlideIn 0.4s ease 0.2s both' }}>
            <p className="text-sm text-neutral-400">No incidents in the past 7 days.</p>
          </div>
        )}

        {/* Report button */}
        <div className="pt-2 text-center" style={{ animation: 'fadeSlideIn 0.4s ease 0.25s both' }}>
          <p className="text-xs text-neutral-400 mb-3">Experiencing something not listed here?</p>
          <button
            onClick={() => setShowReport(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Report an Issue
          </button>
        </div>

        <div className="text-center pb-4">
          <p className="text-xs text-neutral-300">Auto-refreshes every 30s</p>
        </div>
      </main>

      {showReport && (
        reportSuccess ? (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-xs mx-4"
              style={{ animation: 'modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-base font-semibold text-neutral-900">Report submitted</p>
              <p className="text-sm text-neutral-500 mt-1">Thanks for helping us improve.</p>
            </div>
          </div>
        ) : (
          <ReportModal
            onClose={() => setShowReport(false)}
            onSubmit={handleSubmitReport}
            submitting={reportSubmitting}
          />
        )
      )}
    </div>
  );
}
