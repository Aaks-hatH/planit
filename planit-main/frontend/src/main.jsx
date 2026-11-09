import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/planit-theme.css'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#0d0e1c',
          fontWeight: 600,
          borderRadius: '8px',
          boxShadow: '4px 4px 0 #0d0e1c',
          border: '2px solid #0d0e1c'
        },
        success: {
          iconTheme: {
            primary: '#0c8a5b',
            secondary: '#fff'
          }
        },
        error: {
          iconTheme: {
            primary: '#d12f2f',
            secondary: '#fff'
          }
        }
      }}
    />
  </React.StrictMode>,
)
