import { useState, useEffect } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 7-DAY DATA DELETION WARNING BANNER
 * Shows in EventSpace when event data will be deleted in 7 days
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default function DeletionWarningBanner({ eventId }) {
  const [warning, setWarning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    loadWarning();
    // Check every hour for updates
    const interval = setInterval(loadWarning, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [eventId]);

  const loadWarning = async () => {
    try {
      const token = localStorage.getItem('eventToken');
      const response = await fetch(
        `${API_URL}/events/${eventId}/deletion-warning`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to load warning');

      const data = await response.json();
      setWarning(data);

      // Check if dismissed in this session
      const dismissKey = `deletion-dismissed-${eventId}`;
      const isDismissed = sessionStorage.getItem(dismissKey) === 'true';
      setDismissed(isDismissed);

    } catch (error) {
      console.error('Failed to load deletion warning:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('eventToken');
      
      const response = await fetch(
        `${API_URL}/events/${eventId}/export-all-data`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to export data');

      const data = await response.json();
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `event-backup-${eventId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(' All event data downloaded successfully!');

    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download event data');
    } finally {
      setDownloading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(`deletion-dismissed-${eventId}`, 'true');
    setDismissed(true);
  };

  // Don't show if loading or no warning data
  if (loading || !warning) return null;

  // Don't show if not showing warning
  if (!warning.showWarning) return null;

  // Don't show if dismissed and more than 1 day away
  if (dismissed && warning.daysUntilDeletion > 1) return null;

  const { daysUntilDeletion, deletionDate, eventTitle } = warning;

  // Determine severity
  const getSeverity = () => {
    if (daysUntilDeletion <= 1) return 'critical';
    if (daysUntilDeletion <= 3) return 'urgent';
    return 'warning';
  };

  const severity = getSeverity();

  const severityConfig = {
    critical: {
      bg: 'bg-red-600',
      text: 'text-white',
      title: ' CRITICAL: Event data will be deleted TODAY!',
      message: 'All your data (messages, files, check-ins) will be permanently deleted at 2 AM. Download now!',
      allowDismiss: false,
    },
    urgent: {
      bg: 'bg-red-500',
      text: 'text-white',
      title: `⚠️ URGENT: Event data will be deleted in ${daysUntilDeletion} day${daysUntilDeletion !== 1 ? 's' : ''}!`,
      message: 'All event data will be permanently deleted soon. Download your backup now to keep your data.',
      allowDismiss: false,
    },
    warning: {
      bg: 'bg-orange-500',
      text: 'text-white',
      title: `⚠️ Event data will be deleted in ${daysUntilDeletion} days`,
      message: 'Events are automatically deleted 7 days after they occur. Download your data to keep it forever.',
      allowDismiss: true,
    },
  };

  const config = severityConfig[severity];

  return (
    <div className={`${config.bg} ${config.text} shadow-lg ${severity === 'critical' ? 'animate-pulse' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`flex-shrink-0 ${severity === 'critical' ? 'animate-bounce' : ''}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-lg mb-1">
              {config.title}
            </h3>
            <p className="text-sm opacity-95 mb-3">
              {config.message}
            </p>

            {/* What gets deleted */}
            <details className="text-sm opacity-90 mb-3 cursor-pointer">
              <summary className="font-semibold hover:opacity-100">
                 What gets deleted? (Click to see)
              </summary>
              <div className="mt-2 ml-4 space-y-1">
                <p>✓ All event details and settings</p>
                <p>✓ All chat messages and conversations</p>
                <p>✓ All uploaded files and photos</p>
                <p>✓ All polls and voting results</p>
                <p>✓ All participant information</p>
                <p>✓ All check-in records and guest invites</p>
                <p>✓ All security logs and audit trails</p>
                <p className="font-bold mt-2">⚠️ Everything is PERMANENTLY deleted - cannot be recovered!</p>
              </div>
            </details>

            {/* Deletion info */}
            <div className="text-sm opacity-90 mb-4">
              <p className="font-semibold">
                 Deletion scheduled: {new Date(deletionDate).toLocaleString()}
              </p>
            </div>

            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-6 py-3 bg-white text-neutral-900 font-bold rounded-xl hover:bg-neutral-100 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <Download className="w-5 h-5 animate-bounce" />
                  Downloading All Data...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Complete Backup (All Data)
                </>
              )}
            </button>

            {/* Helper text */}
            <p className="text-xs opacity-75 mt-2">
               Backup includes: Event details, all messages, all files (URLs), all check-ins, all participants, everything!
            </p>
          </div>

          {/* Dismiss button (only for warning severity) */}
          {config.allowDismiss && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Dismiss (will show again tomorrow)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
