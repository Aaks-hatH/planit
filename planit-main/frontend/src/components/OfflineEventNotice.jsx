import { WifiOff, RefreshCw, ScanLine } from 'lucide-react';

/**
 * OfflineEventNotice — shown instead of "event not found" when the event page cannot reach the server
 * and has no saved copy of the event. Always offers a way into check-in, which has its own saved login
 * and guest list and says clearly when a staff member still needs to log in while online.
 */
export default function OfflineEventNotice({ title, onRetry, checkinPath }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#f7f7f9' }}>
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-6 h-6 text-amber-600" />
        </div>
        <h1 className="text-lg font-bold text-neutral-900">You're offline</h1>
        <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
          {title ? <><strong>{title}</strong> hasn't been opened on this device yet, so there is no saved copy to show.</> : 'This event has not been opened on this device yet, so there is no saved copy to show.'}
          {' '}It will open as soon as you have a connection.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onRetry} className="min-h-[44px] rounded-xl bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <a href="/" className="min-h-[44px] rounded-xl border border-neutral-200 text-neutral-800 text-sm font-semibold flex items-center justify-center">Back to home</a>
          {checkinPath && (
            <a href={checkinPath} className="min-h-[44px] rounded-xl border border-neutral-200 text-neutral-800 text-sm font-semibold flex items-center justify-center gap-2">
              <ScanLine className="w-4 h-4" /> Open check-in
            </a>
          )}
        </div>
        {checkinPath && (
          <p className="text-xs text-neutral-500 mt-3 leading-relaxed">
            Check-in works offline if you already logged in on this device while online. Staff must log in once with a connection.
          </p>
        )}
      </div>
    </div>
  );
}
