import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';
import { createElement } from 'react';

/**
 * appUpdate.js — "New version available" flow.
 *
 * The service worker no longer swaps itself in silently. When a new version is waiting we show a toast
 * with a Reload button. A reload is REFUSED while any screen has registered a blocker (unsynced
 * check-ins, a scan in progress, a boarding pass on screen), because reloading would interrupt the door.
 */

const blockers = new Map();          // key -> () => string | false   (reason or false)
let updateSW = null;
let toastId = null;

export function setUpdateBlocker(key, fn) {
  if (fn) blockers.set(key, fn); else blockers.delete(key);
}

export function getUpdateBlocker() {
  for (const fn of blockers.values()) {
    try { const reason = fn(); if (reason) return reason; } catch { /* ignore a broken blocker */ }
  }
  return null;
}

function reloadNow() {
  const reason = getUpdateBlocker();
  if (reason) { toast(reason, { icon: '⏳', duration: 5000 }); return false; }
  try { updateSW?.(true); } catch { window.location.reload(); }
  return true;
}

function showUpdateToast() {
  if (toastId) return;
  toastId = toast((t) => createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
    createElement('span', null, 'New version available'),
    createElement('button', {
      onClick: () => { if (reloadNow()) toast.dismiss(t.id); },
      style: { minHeight: 44, padding: '0 14px', borderRadius: 10, background: '#f7f6f2', color: '#0f0f14', fontWeight: 700, border: 0, cursor: 'pointer' },
    }, 'Reload'),
    createElement('button', {
      onClick: () => { toast.dismiss(t.id); toastId = null; },
      'aria-label': 'Later',
      style: { minHeight: 44, minWidth: 44, background: 'transparent', color: '#a1a1aa', border: 0, cursor: 'pointer' },
    }, 'Later'),
  ), { duration: Infinity, id: 'planit-update' });
}

export function initAppUpdate() {
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: showUpdateToast,
      onRegisteredSW(_url, registration) {
        // Look for a new version hourly while the app stays open (door staff leave it open all day).
        if (registration) setInterval(() => { if (navigator.onLine !== false) registration.update().catch(() => {}); }, 60 * 60 * 1000);
      },
    });
  } catch { /* no service worker support */ }
}
