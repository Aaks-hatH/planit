import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/tokens.css'
import './index.css'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
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
