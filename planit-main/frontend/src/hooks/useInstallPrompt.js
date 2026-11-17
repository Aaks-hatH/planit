import { useState, useEffect, useCallback } from 'react';

/**
 * useInstallPrompt
 *
 * Android / desktop Chrome and Edge fire `beforeinstallprompt` once, early. captureInstallPrompt()
 * is called from main.jsx so the event is not lost before a component mounts. iOS Safari has no such
 * event, so we detect it and the UI shows manual "Add to Home Screen" instructions.
 */

const DISMISS_KEY = 'planit_install_dismissed_at';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

let deferredPrompt = null;
let installedFlag = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

let captured = false;
export function captureInstallPrompt() {
  if (captured || typeof window === 'undefined') return;
  captured = true;
  try {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      notify();
    });
    window.addEventListener('appinstalled', () => {
      installedFlag = true;
      deferredPrompt = null;
      notify();
    });
  } catch { /* unsupported */ }
}

function detectInstalled() {
  try {
    if (installedFlag) return true;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
  } catch { /* ignore */ }
  return false;
}

function detectIOSSafari() {
  try {
    const ua = navigator.userAgent || '';
    const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || iPadOS;
    if (!isIOSDevice) return false;
    // Other iOS browsers and in-app browsers cannot add to the Home Screen the same way.
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(ua);
  } catch { return false; }
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch { return false; }
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    captureInstallPrompt();
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    // display-mode can change when the app is installed while this tab is open
    let mq = null;
    try {
      if (typeof window.matchMedia === 'function') {
        mq = window.matchMedia('(display-mode: standalone)');
        mq.addEventListener?.('change', fn);
      }
    } catch { /* ignore */ }
    return () => { listeners.delete(fn); try { mq?.removeEventListener?.('change', fn); } catch { /* ignore */ } };
  }, []);

  const isInstalled = detectInstalled();
  const isIOS = detectIOSSafari();
  const dismissed = recentlyDismissed();
  const canInstall = !!deferredPrompt && !isInstalled && !dismissed;
  const showIOSHelp = isIOS && !isInstalled && !dismissed;

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    notify();
  }, []);

  const promptInstall = useCallback(async () => {
    const evt = deferredPrompt;
    if (!evt) return 'dismissed';
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      deferredPrompt = null;               // an install prompt can only be used once
      if (choice?.outcome === 'accepted') { notify(); return 'accepted'; }
      dismiss();
      return 'dismissed';
    } catch {
      return 'dismissed';
    }
  }, [dismiss]);

  return { canInstall, isInstalled, isIOS, showIOSHelp, dismissed, promptInstall, dismiss };
}

export default useInstallPrompt;
