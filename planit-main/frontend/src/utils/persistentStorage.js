/**
 * persistentStorage.js
 *
 * Safari and low-storage Android phones may evict IndexedDB / localStorage when space runs low.
 * That would silently delete the saved guest list and any unsynced check-ins. Asking the browser
 * for "persistent" storage tells it not to. Every call is feature-detected and never throws.
 */

let requested = false;

export async function requestPersistentStorage() {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
    if (!storage || typeof storage.persist !== 'function') return false;
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    if (requested) return false;          // once per page load: Firefox shows a prompt for each call
    requested = true;
    return !!(await storage.persist());
  } catch {
    return false;
  }
}

export async function getStorageStatus() {
  const status = { persisted: false, usageBytes: null, quotaBytes: null, supported: false };
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : null;
    if (!storage) return status;
    status.supported = typeof storage.persist === 'function';
    if (typeof storage.persisted === 'function') status.persisted = !!(await storage.persisted());
    if (typeof storage.estimate === 'function') {
      const est = await storage.estimate();
      status.usageBytes = est?.usage ?? null;
      status.quotaBytes = est?.quota ?? null;
    }
  } catch { /* unsupported: report what we have */ }
  return status;
}
