import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, X, AlertTriangle, AlertOctagon, Info, Shield, ChevronRight } from 'lucide-react';

/**
 * SecurityAlerts
 *
 * Floating badge in the corner of the organizer dashboard that accumulates
 * security alerts emitted by the server over Socket.IO (`security_alert` event).
 * Clicking the badge opens a slide-out panel listing every alert.
 *
 * Also handles offline sync conflicts surfaced by offlineCheckin.flushQueue().
 *
 * Props:
 *   alerts      — array of alert objects (managed by parent via useSecurityAlerts)
 *   onDismiss   — fn(index) called when the user dismisses a single alert
 *   onDismissAll — fn() called when the user clears all alerts
 */

const SEVERITY_CONFIG = {
  critical: {
    bg:     'bg-red-950',
    border: 'border-red-700',
    badge:  'bg-red-600',
    text:   'text-red-400',
    icon:   AlertOctagon,
    label:  'Critical',
  },
  high: {
    bg:     'bg-orange-950',
    border: 'border-orange-700',
    badge:  'bg-orange-500',
    text:   'text-orange-400',
    icon:   AlertTriangle,
    label:  'High',
  },
  medium: {
    bg:     'bg-yellow-950',
    border: 'border-yellow-700',
    badge:  'bg-yellow-500',
    text:   'text-yellow-400',
    icon:   Shield,
    label:  'Medium',
  },
  low: {
    bg:     'bg-neutral-900',
    border: 'border-neutral-700',
    badge:  'bg-neutral-500',
    text:   'text-neutral-400',
    icon:   Info,
    label:  'Low',
  },
};

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

function AlertCard({ alert, index, onDismiss }) {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
  const Icon = cfg.icon;
  return (
    <div className={`rounded-xl border ${cfg.bg} ${cfg.border} p-4 relative`}>
      <button
        onClick={() => onDismiss(index)}
        className="absolute top-3 right-3 text-neutral-500 hover:text-white transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className={`mt-0.5 shrink-0 ${cfg.text}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
            <span className="text-xs text-neutral-500">{fmtTime(alert.timestamp)}</span>
          </div>
          <p className="text-sm text-white font-medium leading-snug mb-1">{alert.message}</p>
          {alert.guestName && (
            <p className="text-xs text-neutral-400">
              Guest: <span className="text-neutral-200 font-medium">{alert.guestName}</span>
              {alert.inviteCode && <span className="text-neutral-500 ml-1">#{alert.inviteCode}</span>}
            </p>
          )}
          {alert.error === 'already_checked_in' && (
            <p className="text-xs text-orange-400 mt-1">
              This guest was admitted offline but was already checked in on another device.
              Verify with your team.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SecurityAlerts({ alerts = [], onDismiss, onDismissAll }) {
  const [open, setOpen]     = useState(false);
  const panelRef            = useRef(null);
  const prevCount           = useRef(0);

  // Auto-open panel on first critical alert
  useEffect(() => {
    const newCriticals = alerts.filter(a => a.severity === 'critical');
    if (newCriticals.length > 0 && alerts.length > prevCount.current) {
      setOpen(true);
    }
    prevCount.current = alerts.length;
  }, [alerts]);

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (alerts.length === 0) return null;

  const highestSeverity = alerts.some(a => a.severity === 'critical') ? 'critical'
    : alerts.some(a => a.severity === 'high')     ? 'high'
    : alerts.some(a => a.severity === 'medium')   ? 'medium'
    : 'low';

  const badgeCfg = SEVERITY_CONFIG[highestSeverity];

  return (
    <>
      {/* ── Floating trigger badge ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl
          ${highestSeverity === 'critical' ? 'bg-red-600 animate-pulse' : 'bg-neutral-800 border border-neutral-700'}
          text-white font-bold text-sm transition-all hover:scale-105 active:scale-95`}
        aria-label={`${alerts.length} security alert${alerts.length !== 1 ? 's' : ''}`}
      >
        <ShieldAlert className="w-4 h-4" />
        <span>{alerts.length}</span>
        <span className="hidden sm:inline">Security Alert{alerts.length !== 1 ? 's' : ''}</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {/* ── Slide-out panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] max-h-[70vh] flex flex-col
            bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              <span className="text-white font-bold text-sm">Security Alerts</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCfg.badge} text-white`}>
                {alerts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onDismissAll}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-500 hover:text-white transition-colors ml-2"
                aria-label="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {[...alerts].reverse().map((alert, i) => (
              <AlertCard
                key={`${alert.timestamp}-${i}`}
                alert={alert}
                index={alerts.length - 1 - i}
                onDismiss={onDismiss}
              />
            ))}
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 border-t border-neutral-800 shrink-0">
            <p className="text-xs text-neutral-500">
              Alerts are live — they reflect real-time security events from your check-in system.
              Offline sync conflicts appear here after reconnection.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * useSecurityAlerts()
 *
 * React hook that manages the alerts array. Wire the returned `addAlert`
 * into your Socket.IO `security_alert` listener and into the offline
 * flushQueue result.
 *
 * Usage:
 *   const { alerts, addAlert, dismissAlert, dismissAll } = useSecurityAlerts();
 *   socketService.on('security_alert', addAlert);
 */
export function useSecurityAlerts() {
  const [alerts, setAlerts] = useState([]);

  function addAlert(alert) {
    setAlerts(prev => [...prev, { ...alert, timestamp: alert.timestamp || new Date().toISOString() }]);
  }

  function addConflicts(conflicts) {
    // conflicts come from offlineCheckin.flushQueue()
    for (const conflict of conflicts) {
      addAlert({
        type:     conflict.error,
        severity: conflict.error === 'already_checked_in' ? 'high' : 'critical',
        guestName:   conflict.guestName,
        inviteCode:  conflict.inviteCode,
        message:     conflict.serverMessage || `Sync conflict for ${conflict.guestName}`,
        error:       conflict.error,
        offline:     true,
      });
    }
  }

  function dismissAlert(index) {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  }

  function dismissAll() {
    setAlerts([]);
  }

  return { alerts, addAlert, addConflicts, dismissAlert, dismissAll };
}
