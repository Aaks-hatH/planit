/**
 * offlineCheckin.js
 *
 * Manages the offline-first check-in flow for the Enterprise Check-in page.
 *
 * Two concerns:
 *
 * 1. CACHE  — A full snapshot of the event's guest list is stored in IndexedDB
 *             when the check-in page loads. When the device goes offline, the
 *             scanner reads from this cache instead of hitting the server.
 *
 * 2. QUEUE  — Every scan that happens while offline is added to a queue.
 *             When connectivity returns the queue is flushed against the real
 *             API, which runs the full server-side security suite.
 *             Conflicts (same QR used on two offline devices) are surfaced as
 *             flags back to the organizer — never silently swallowed.
 *
 * Usage:
 *   import offlineCheckin from './offlineCheckin';
 *
 *   // On page load — download + cache the guest list
 *   await offlineCheckin.refreshCache(eventId, token);
 *
 *   // On QR scan — lookup locally, optimistically admit, queue sync
 *   const result = offlineCheckin.lookupGuest(inviteCode);
 *   offlineCheckin.queueCheckin(eventId, inviteCode, actualAttendees);
 *
 *   // When online event fires — flush the queue
 *   const results = await offlineCheckin.flushQueue(token);
 *
 *   // Read connection state
 *   offlineCheckin.isOnline()
 */

const DB_NAME    = 'planit_checkin';
const DB_VERSION = 2;
const STORE_CACHE = 'guest_cache';   // { key: eventId, snapshot: [...], builtAt }
const STORE_QUEUE = 'checkin_queue'; // { id, eventId, inviteCode, actualAttendees, queuedAt, attempts, lastError }

// ─── IndexedDB bootstrap ───────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'eventId' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        qs.createIndex('eventId', 'eventId', { unique: false });
        qs.createIndex('dedupeKey', 'dedupeKey', { unique: false });
      } else {
        const qs = e.target.transaction.objectStore(STORE_QUEUE);
        if (!qs.indexNames.contains('dedupeKey')) {
          qs.createIndex('dedupeKey', 'dedupeKey', { unique: false });
        }
      }
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

function dbGet(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  }));
}

function dbPut(store, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function dbGetAll(store) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  }));
}

function dbDelete(store, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

function dbClear(store) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}


function normalizeInviteCode(inviteCode) {
  return String(inviteCode || '').toUpperCase().trim();
}

async function updateCachedGuest(eventId, inviteCode, patch) {
  const cached = await dbGet(STORE_CACHE, eventId);
  if (!cached || !Array.isArray(cached.snapshot)) return false;
  const key = normalizeInviteCode(inviteCode);
  let changed = false;
  const snapshot = cached.snapshot.map(guest => {
    if (normalizeInviteCode(guest.code) !== key) return guest;
    changed = true;
    return { ...guest, ...patch };
  });
  if (!changed) return false;
  await dbPut(STORE_CACHE, { ...cached, snapshot, lastLocalUpdate: new Date().toISOString() });
  _buildMap(snapshot);
  return true;
}

async function dbUpdateQueueItem(item) {
  return dbPut(STORE_QUEUE, item);
}

// ─── In-memory map built from the snapshot for O(1) lookups ───────────────

let _currentEventId = null;
let _guestMap = new Map(); // inviteCode → guest record (also tracks offline check-ins)

function _buildMap(snapshot) {
  _guestMap = new Map();
  for (const guest of snapshot) {
    _guestMap.set(normalizeInviteCode(guest.code), { ...guest });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

const offlineCheckin = {

  /**
   * isOnline() — true if navigator.onLine is true.
   * Use this to decide whether to go optimistic (offline) or full server verify.
   */
  isOnline() {
    return navigator.onLine !== false;
  },

  /**
   * refreshCache(eventId, apiCallFn)
   * Downloads the full guest list snapshot and stores it in IndexedDB.
   * apiCallFn is expected to return the response of eventAPI.getCheckinCache(eventId).
   *
   * Call this on page mount and whenever connectivity is restored.
   */
  async refreshCache(eventId, apiCallFn) {
    try {
      const res  = await apiCallFn();
      const data = res.data;
      if (!data || !Array.isArray(data.snapshot)) {
        console.warn('[offlineCheckin] refreshCache: unexpected response shape', data);
        return false;
      }
      await dbPut(STORE_CACHE, {
        eventId,
        snapshot: data.snapshot,
        builtAt:  data.builtAt || new Date().toISOString(),
        total:    data.total   || data.snapshot.length,
      });
      _currentEventId = eventId;
      _buildMap(data.snapshot);
      console.log(`[offlineCheckin] Cache refreshed: ${data.snapshot.length} guests for event ${eventId}`);
      return true;
    } catch (err) {
      console.error('[offlineCheckin] refreshCache failed:', err);
      // Try to hydrate from existing IndexedDB cache so map is populated even if fetch failed
      await this.loadCacheFromDB(eventId);
      return false;
    }
  },

  /**
   * loadCacheFromDB(eventId)
   * Hydrates the in-memory map from a previously cached snapshot.
   * Called if refreshCache fails (e.g. offline on mount).
   */
  async loadCacheFromDB(eventId) {
    try {
      const cached = await dbGet(STORE_CACHE, eventId);
      if (cached && Array.isArray(cached.snapshot)) {
        _currentEventId = eventId;
        _buildMap(cached.snapshot);
        console.log(`[offlineCheckin] Loaded ${cached.snapshot.length} guests from DB cache (built ${cached.builtAt})`);
        return cached;
      }
      return null;
    } catch (err) {
      console.error('[offlineCheckin] loadCacheFromDB failed:', err);
      return null;
    }
  },

  /**
   * cacheAge(eventId)
   * Returns milliseconds since last cache refresh, or Infinity if no cache.
   * Useful for showing a "cache is X minutes old" warning in the UI.
   */
  async cacheAge(eventId) {
    try {
      const cached = await dbGet(STORE_CACHE, eventId);
      if (!cached || !cached.builtAt) return Infinity;
      return Date.now() - new Date(cached.builtAt).getTime();
    } catch { return Infinity; }
  },

  /**
   * lookupGuest(inviteCode)
   * O(1) in-memory lookup from the snapshot map.
   * Returns the guest record or null if not found.
   * Reflects any offline check-ins already applied this session.
   */
  lookupGuest(inviteCode) {
    if (!inviteCode) return null;
    return _guestMap.get(normalizeInviteCode(inviteCode)) ?? null;
  },

  /**
   * markCheckedInLocally(inviteCode, actualAttendees, staffUser)
   * Optimistically marks a guest as checked in in the local map.
   * Does NOT write to IndexedDB — the map is session-only.
   * The server remains the source of truth once the queue flushes.
   */
  async markCheckedInLocally(inviteCode, actualAttendees, staffUser, eventId = _currentEventId) {
    const key   = normalizeInviteCode(inviteCode);
    const guest = _guestMap.get(key);
    if (!guest) return false;
    const patch = {
      checkedIn:    true,
      checkedInAt:  new Date().toISOString(),
      checkedInBy:  staffUser || 'offline-staff',
      actualAttendees,
      pendingOfflineSync: true,
    };
    _guestMap.set(key, { ...guest, ...patch });
    if (eventId) await updateCachedGuest(eventId, key, patch);
    return true;
  },

  /**
   * queueCheckin(eventId, inviteCode, actualAttendees)
   * Adds a check-in to the offline queue stored in IndexedDB.
   * Items are flushed against the server when connectivity returns.
   */
  async queueCheckin(eventId, inviteCode, actualAttendees) {
    try {
      const normalizedCode = normalizeInviteCode(inviteCode);
      const all = await dbGetAll(STORE_QUEUE);
      const existing = all.find(item => item.eventId === eventId && item.inviteCode === normalizedCode);
      if (existing) {
        await dbPut(STORE_QUEUE, {
          ...existing,
          actualAttendees: actualAttendees ?? existing.actualAttendees ?? null,
          updatedAt: new Date().toISOString(),
        });
        return existing.id;
      }
      const id = await dbPut(STORE_QUEUE, {
        eventId,
        inviteCode: normalizedCode,
        dedupeKey: `${eventId}:${normalizedCode}`,
        actualAttendees: actualAttendees ?? null,
        queuedAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
      });
      console.log(`[offlineCheckin] Queued check-in: ${normalizedCode}`);
      return id;
    } catch (err) {
      console.error('[offlineCheckin] queueCheckin failed:', err);
      throw err;
    }
  },

  /**
   * pendingCount(eventId)
   * How many unsynced check-ins are in the queue for this event.
   */
  async pendingCount(eventId) {
    try {
      const all = await dbGetAll(STORE_QUEUE);
      return all.filter(item => item.eventId === eventId).length;
    } catch { return 0; }
  },

  /**
   * flushQueue(eventId, apiCallFn)
   * Drains the offline queue, calling apiCallFn for each item.
   * apiCallFn(inviteCode, actualAttendees) should call
   *   eventAPI.checkIn(eventId, inviteCode, { actualAttendees, pinVerified: false })
   * and return the axios response.
   *
   * Returns:
   *   { synced, failed, conflicts }
   *   conflicts: array of { inviteCode, guestName, error, serverMessage }
   *     — items the server rejected after accepting them offline.
   *     These are surfaced to the organizer as security flags.
   */
  async flushQueue(eventId, apiCallFn) {
    const results = { synced: 0, failed: 0, conflicts: [] };
    try {
      const all   = await dbGetAll(STORE_QUEUE);
      const items = all.filter(item => item.eventId === eventId)
                       .sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));

      for (const item of items) {
        try {
          await apiCallFn(item.inviteCode, item.actualAttendees);
          await dbDelete(STORE_QUEUE, item.id);
          await updateCachedGuest(eventId, item.inviteCode, { pendingOfflineSync: false });
          results.synced++;
        } catch (err) {
          const status  = err?.response?.status;
          const message = err?.response?.data?.error || 'Unknown error';

          if (status === 400 && message.toLowerCase().includes('already checked in')) {
            // Another device checked in this guest while we were offline — conflict
            const guest = this.lookupGuest(item.inviteCode);
            results.conflicts.push({
              inviteCode:    item.inviteCode,
              guestName:     guest?.name || item.inviteCode,
              error:         'already_checked_in',
              serverMessage: message,
              queuedAt:      item.queuedAt,
            });
            await dbDelete(STORE_QUEUE, item.id);
          } else if (status === 403) {
            // Server-side security block (blocked ticket, wrong event, capacity)
            const guest = this.lookupGuest(item.inviteCode);
            results.conflicts.push({
              inviteCode:    item.inviteCode,
              guestName:     guest?.name || item.inviteCode,
              error:         err?.response?.data?.reason || 'security_block',
              serverMessage: message,
              queuedAt:      item.queuedAt,
            });
            await dbDelete(STORE_QUEUE, item.id);
          } else {
            // Network / server error — keep in queue for next flush attempt
            results.failed++;
            await dbUpdateQueueItem({ ...item, attempts: (item.attempts || 0) + 1, lastError: message, lastAttemptAt: new Date().toISOString() });
            console.warn(`[offlineCheckin] Flush failed for ${item.inviteCode} (status ${status}):`, message);
          }
        }
      }

      console.log(`[offlineCheckin] Queue flush: synced=${results.synced} failed=${results.failed} conflicts=${results.conflicts.length}`);
    } catch (err) {
      console.error('[offlineCheckin] flushQueue error:', err);
    }
    return results;
  },

  /**
   * clearCache(eventId)
   * Remove the cached snapshot for this event (e.g. on logout).
   */
  async queueItems(eventId) {
    try {
      const all = await dbGetAll(STORE_QUEUE);
      return all.filter(item => item.eventId === eventId)
                .sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
    } catch { return []; }
  },

  async cacheInfo(eventId) {
    try {
      const cached = await dbGet(STORE_CACHE, eventId);
      if (!cached) return null;
      return {
        builtAt: cached.builtAt || null,
        total: cached.total || cached.snapshot?.length || 0,
        ageMs: cached.builtAt ? Date.now() - new Date(cached.builtAt).getTime() : Infinity,
        lastLocalUpdate: cached.lastLocalUpdate || null,
      };
    } catch { return null; }
  },

  async clearCache(eventId) {
    try {
      await dbDelete(STORE_CACHE, eventId);
      if (_currentEventId === eventId) {
        _guestMap  = new Map();
        _currentEventId = null;
      }
    } catch (err) {
      console.error('[offlineCheckin] clearCache failed:', err);
    }
  },
};

export default offlineCheckin;
