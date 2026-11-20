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

/**
 * detectInstallPlatform
 * Works out which "Add to Home Screen / Install" steps apply to this device. Browsers do not agree on
 * how installing works, so the guide needs to know the device AND the browser:
 *   iphone         Safari on iPhone
 *   ipad           Safari on iPad (iPadOS reports itself as a Mac, so touch points tell them apart)
 *   iphone-chrome  Chrome on iPhone or iPad (needs iOS 16.4+)
 *   android        Chrome, Samsung Internet and most other Android browsers
 *   mac            Safari on a Mac (Add to Dock, macOS Sonoma / Safari 17+)
 *   desktop        Chrome or Edge on a computer
 *   other          anything else (Firefox, in-app browsers, ...). The guide asks which device to show.
 * `inApp` is true inside the Facebook / Instagram / TikTok style browsers, which cannot install apps at all.
 */
export function detectInstallPlatform() {
  try {
    const ua = navigator.userAgent || '';
    const touch = (navigator.maxTouchPoints || 0) > 1;
    const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|; wv\)/i.test(ua);
    const isIOSDevice = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
    if (isIOSDevice) {
      const isPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
      if (/CriOS/.test(ua)) return { id: 'iphone-chrome', inApp };
      if (/FxiOS|EdgiOS|OPiOS|OPT\//.test(ua) || inApp) return { id: 'other', inApp };
      return { id: isPad ? 'ipad' : 'iphone', inApp };
    }
    if (/Android/.test(ua)) return { id: 'android', inApp };
    if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua)) return { id: 'mac', inApp };
    if (/Chrome|Chromium|Edg\//.test(ua) && !/Mobile/.test(ua)) return { id: 'desktop', inApp };
    return { id: 'other', inApp };
  } catch {
    return { id: 'other', inApp: false };
  }
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
  const platform = detectInstallPlatform();
  const dismissed = recentlyDismissed();
  // The banner follows the 14-day dismissal. The "Install the app" button and its guide do not: they
  // use canPromptNow / platform, which ignore it, so someone who closed the banner can still install.
  const canInstall = !!deferredPrompt && !isInstalled && !dismissed;
  const canPromptNow = !!deferredPrompt && !isInstalled;
  const showIOSHelp = (isIOS || platform.id === 'iphone-chrome') && !isInstalled && !dismissed;

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    notify();
  }, []);

  // rememberDismiss: when the person cancels the browser's own install dialog, the banner stays hidden for
  // 14 days. The guide passes false, because opening it was a deliberate choice, not a banner to snooze.
  const promptInstall = useCallback(async ({ rememberDismiss = true } = {}) => {
    const evt = deferredPrompt;
    if (!evt) return 'unavailable';
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      deferredPrompt = null;               // an install prompt can only be used once
      if (choice?.outcome === 'accepted') { notify(); return 'accepted'; }
      if (rememberDismiss) dismiss(); else notify();
      return 'dismissed';
    } catch {
      return 'dismissed';
    }
  }, [dismiss]);

  return { canInstall, canPromptNow, isInstalled, isIOS, platform, showIOSHelp, dismissed, promptInstall, dismiss };
}

export default useInstallPrompt;
