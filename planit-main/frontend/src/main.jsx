import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './index.css'
import { Toaster } from 'react-hot-toast'
import { initAppUpdate } from './utils/appUpdate'
import { captureInstallPrompt } from './hooks/useInstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { showError } from './utils/toast'
import { explainError } from './utils/friendlyError'

captureInstallPrompt()   // catch beforeinstallprompt before any component mounts
initAppUpdate()          // service worker + "New version available" toast

// Failures nobody caught (a forgotten .catch, a stale lazy chunk) used to vanish silently.
// Show one explained toast for them — throttled so a failing background poll can't spam.
let lastGlobalToast = 0;
function reportUncaught(reason) {
  try {
    const info = explainError(reason);
    // Cancelled requests, offline blips and expired sessions are handled elsewhere in the app.
    if (['canceled', 'offline', 'auth'].includes(info.kind)) return;
    const now = Date.now();
    if (now - lastGlobalToast < 15000) return;
    lastGlobalToast = now;
    console.error('[uncaught]', reason);
    showError(reason, '', { id: 'uncaught-error' });
  } catch { /* reporting must never throw */ }
}
window.addEventListener('unhandledrejection', (e) => reportUncaught(e.reason));
// Vite fires this when a lazy chunk fails to load after a new deploy.
window.addEventListener('vite:preloadError', (e) => { e.preventDefault?.(); reportUncaught(new Error('Failed to fetch dynamically imported module')); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster
      position="top-right"
      containerStyle={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#0f0f14',
          color: '#f7f6f2',
          borderRadius: '10px',
          boxShadow: '0 12px 28px -6px rgba(15,15,20,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '10px 14px',
          maxWidth: 'min(26rem, calc(100vw - 2rem))',
        },
        success: { iconTheme: { primary: '#16a34a', secondary: '#0f0f14' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#0f0f14' }, duration: 6000 },
      }}
    />
  </React.StrictMode>,
)
