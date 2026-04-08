import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#0f172a',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff'
          }
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff'
          }
        }
      }}
    />
  </React.StrictMode>,
)
