/**
 * friendlyError — turns any thrown thing (axios error, DOMException, plain Error,
 * string) into something a non-technical person can act on:
 *
 *   { kind, status, headline, why, fix, known, retryable, ref, details }
 *
 *   headline   short "what happened"
 *   why        plain-language reason it failed
 *   fix        what the person can do about it
 *   known      false when we genuinely can't tell what went wrong. The UI then says so
 *              plainly and points the person at support instead of guessing.
 *   ref        short reference code to quote to support
 *   details    technical summary for the "email support" link (never contains tokens)
 *
 * Pure functions only — no React, no DOM writes — so it is safe to import anywhere.
 */

export const SUPPORT_EMAIL = 'planit.userhelp@gmail.com';
export const HELP_PATH = '/help';
export const STATUS_PATH = '/status';

/* ── Last API failure ────────────────────────────────────────────────────────
 * Most call sites do `catch { toast.error('Failed') }` and never look at the error.
 * The axios interceptor records every failed request here, and the toast wrapper
 * picks it up if it is fresh, so those sites get a real explanation without edits. */
let lastApiError = null;

export function recordApiError(error) {
  lastApiError = { error, at: Date.now() };
}

/** Returns (and clears) the last API failure if it happened within `maxAgeMs`. */
export function takeRecentApiError(maxAgeMs = 3000) {
  if (!lastApiError) return null;
  const fresh = Date.now() - lastApiError.at <= maxAgeMs;
  const { error } = lastApiError;
  lastApiError = null;
  return fresh ? error : null;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

export function makeRef() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `PI-${time}${rand}`;
}

// Server strings that carry no meaning for a person.
const GENERIC_SERVER = /^(error|server error|internal server error|an unexpected error occurred\.?|validation error|duplicate error|not found|forbidden|unauthorized|bad request|invalid id|invalid token|token expired|cors error|too many requests|storage error)\.?$/i;

const CHUNK_RE = /Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

function serverMessage(data) {
  if (!data) return '';
  if (typeof data === 'string') return /^\s*</.test(data) ? '' : data.trim().slice(0, 300); // ignore HTML error pages
  const details = Array.isArray(data.details) ? data.details.filter(Boolean).join(' · ') : '';
  const msg = [data.message, data.error].find(s => typeof s === 'string' && s.trim() && !GENERIC_SERVER.test(s.trim()));
  return (details || msg || '').toString().trim().slice(0, 300);
}

function serverLabel(data) {
  if (!data || typeof data === 'string') return '';
  return [data.error, data.message].filter(s => typeof s === 'string').join(' ');
}

function safePath(url = '') {
  try { return String(url).split('?')[0].replace(/^https?:\/\/[^/]+/, '').replace(/[a-f0-9]{40,}/gi, '…'); }
  catch { return ''; }
}

function buildDetails(err, status, ref) {
  const cfg = err?.config || {};
  const lines = [
    `Reference: ${ref}`,
    status ? `HTTP status: ${status}` : null,
    err?.code ? `Error code: ${err.code}` : null,
    err?.name && !err?.isAxiosError ? `Error type: ${err.name}` : null,
    cfg.url ? `Request: ${(cfg.method || 'get').toUpperCase()} ${safePath(cfg.url)}` : null,
    err?.response?.data && typeof err.response.data === 'object'
      ? `Server said: ${serverLabel(err.response.data).slice(0, 200)}` : null,
    typeof window !== 'undefined' ? `Page: ${window.location.pathname}` : null,
    `Time: ${new Date().toISOString()}`,
    typeof navigator !== 'undefined' ? `Online: ${navigator.onLine}` : null,
    typeof navigator !== 'undefined' ? `Browser: ${navigator.userAgent}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

export function supportMailto({ headline, ref, details }) {
  const subject = `PlanIt problem${headline ? ` — ${headline}` : ''} [${ref}]`;
  const body = [
    'Hi PlanIt support,',
    '',
    'Something went wrong. What I was trying to do:',
    '(please describe — and include your event link if you can)',
    '',
    '— Technical details (please leave these in) —',
    details,
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/* ── Main entry ──────────────────────────────────────────────────────────── */

/**
 * @param {*} err      axios error | Error | DOMException | string | anything
 * @param {{title?: string}} [ctx]  title = what the person was trying to do ("Could not save the task")
 */
export function explainError(err) {
  const ref = makeRef();
  const res = err?.response;
  const status = res?.status || 0;
  const data = res?.data;
  const srv = serverMessage(data);
  const label = serverLabel(data);
  const code = err?.code;
  const name = err?.name;
  const msg = typeof err === 'string' ? err : (err?.message || '');
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  const out = (o) => ({
    status, ref, retryable: false, known: true, kind: 'unknown', serverMessage: srv,
    details: buildDetails(err, status, ref),
    ...o,
  });

  // ── Stale deploy: a lazy-loaded chunk no longer exists ──
  if (CHUNK_RE.test(msg)) {
    return out({
      kind: 'chunk', retryable: true,
      headline: 'PlanIt just updated',
      why: 'A newer version of PlanIt was released while this page was open, so part of the page could not be loaded.',
      fix: 'Refresh the page to get the latest version. Nothing you have already saved is lost.',
    });
  }

  // ── No response from the server ──
  if (!res && (offline || code === 'ERR_NETWORK' || /^Network Error$/i.test(msg) || /Failed to fetch|Load failed|NetworkError/i.test(msg))) {
    if (offline) {
      return out({
        kind: 'offline', retryable: true,
        headline: 'You appear to be offline',
        why: 'Your device has no internet connection right now, so the request never reached PlanIt.',
        fix: 'Reconnect to Wi-Fi or mobile data, then try again. Your last action was not saved.',
      });
    }
    return out({
      kind: 'network', retryable: true,
      headline: "Couldn't reach PlanIt",
      why: 'The request did not get through. This is usually a dropped connection, a VPN, firewall or ad blocker getting in the way, or the server waking up after being idle.',
      fix: 'Check your connection, turn off any VPN or content blocker for this site, and try again in a few seconds. If it keeps happening, see the status page.',
    });
  }

  if (!res && (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(msg))) {
    return out({
      kind: 'timeout', retryable: true,
      headline: 'This took too long',
      why: "PlanIt didn't answer in time. Free hosting can take up to 30 seconds to wake up after being idle, and slow connections can cause this too.",
      fix: 'Wait a few seconds and try again — it is usually fast the second time.',
    });
  }

  if (code === 'ERR_CANCELED' || name === 'CanceledError' || name === 'AbortError') {
    return out({ kind: 'canceled', headline: 'Cancelled', why: 'The request was cancelled before it finished.', fix: 'Try again if you still need it.', retryable: true });
  }

  // ── Browser / device errors (camera, clipboard, storage…) ──
  if (!res && name === 'NotAllowedError') {
    return out({
      kind: 'permission',
      headline: 'Permission was blocked',
      why: 'Your browser or device refused access (for example to the camera, microphone, clipboard or notifications).',
      fix: 'Tap the lock or camera icon in the address bar, set the permission to Allow, then reload and try again. In-app browsers (Instagram, Facebook) often block this — open the link in Chrome or Safari.',
    });
  }
  if (!res && (name === 'NotFoundError' || name === 'OverconstrainedError')) {
    return out({
      kind: 'device',
      headline: "Couldn't find the device",
      why: 'No camera or microphone matching the request was found on this device.',
      fix: 'Check that a camera is connected and not disabled, then reload and try again.',
    });
  }
  if (!res && (name === 'NotReadableError' || name === 'TrackStartError')) {
    return out({
      kind: 'device',
      headline: 'Camera is in use',
      why: 'Another app or browser tab is already using the camera or microphone.',
      fix: 'Close other apps or tabs that might be using it, then try again.',
    });
  }
  if (!res && (name === 'QuotaExceededError' || /quota/i.test(msg))) {
    return out({
      kind: 'storage',
      headline: 'This device is out of storage',
      why: "Your browser has no room left to save PlanIt's data on this device.",
      fix: 'Free up some space (clear old downloads or browser data for this site) and try again.',
    });
  }
  if (!res && name === 'SecurityError') {
    return out({
      kind: 'security',
      headline: 'Your browser blocked this',
      why: 'A browser security setting prevented the action (private mode and in-app browsers do this often).',
      fix: 'Open PlanIt in a regular Chrome or Safari window (not private mode) and try again.',
    });
  }

  // ── HTTP responses ──
  if (res) {
    const tokenExpired = /token expired|expired/i.test(label);
    switch (true) {
      case status === 400 || status === 422:
        return out({
          kind: 'validation',
          headline: "Some information isn't right",
          why: srv || "The server couldn't accept what was sent — a required field may be missing or in the wrong format.",
          fix: 'Check the highlighted or required fields, correct anything that looks off, and try again.',
        });
      case status === 401:
        return out({
          kind: 'auth', retryable: false,
          headline: tokenExpired || !srv ? 'Your session has expired' : 'Sign-in problem',
          why: srv || 'You were signed out for security (sessions end after a while) or the sign-in details were not accepted.',
          fix: tokenExpired || !srv
            ? 'Sign in again and repeat what you were doing.'
            : 'Double-check the password or PIN and try again. If you forgot it, use "Forgot password" with your recovery code.',
        });
      case status === 403:
        return out({
          kind: 'permission',
          headline: "You don't have access to this",
          why: srv || 'Your account does not have permission for this action — staff accounts, for example, cannot change event settings.',
          fix: 'Sign in as the event organiser, or ask the organiser to do this for you.',
        });
      case status === 404:
        return out({
          kind: 'notfound',
          headline: "We couldn't find that",
          why: srv || 'It may have been deleted (PlanIt removes events 7 days after the event date), or the link may be mistyped or incomplete.',
          fix: 'Check the link, refresh the page, or go back and open it again from your event.',
        });
      case status === 408:
        return out({ kind: 'timeout', retryable: true, headline: 'This took too long', why: 'The server timed out waiting for the request.', fix: 'Try again in a few seconds.' });
      case status === 409:
        return out({
          kind: 'conflict',
          headline: 'This conflicts with existing data',
          why: srv || 'The same thing already exists, or someone else changed it at the same time.',
          fix: 'Refresh the page to see the latest version, then try again.',
        });
      case status === 410:
        return out({ kind: 'gone', headline: 'This link has expired', why: srv || 'The item or link you are using is no longer available.', fix: 'Ask the organiser for a new link.' });
      case status === 413:
        return out({ kind: 'toolarge', headline: 'That file is too big', why: srv || 'The file is larger than PlanIt accepts.', fix: 'Use a smaller file (compress the image or PDF) and try again.' });
      case status === 415:
        return out({ kind: 'filetype', headline: "That file type isn't supported", why: srv || 'PlanIt does not accept this kind of file.', fix: 'Use a standard image (JPG, PNG, WebP) or PDF and try again.' });
      case status === 429:
        return out({
          kind: 'ratelimit', retryable: true,
          headline: 'Too many attempts',
          why: srv || "You've sent a lot of requests in a short time, so PlanIt is pausing you briefly to stay safe for everyone.",
          fix: 'Wait about a minute, then try again.',
        });
      case status === 502 || status === 503 || status === 504:
        return out({
          kind: 'unavailable', retryable: true,
          headline: 'PlanIt is temporarily unavailable',
          why: 'The server is restarting, being updated, or is overloaded for a moment.',
          fix: 'Wait 30–60 seconds and try again. The status page shows if there is a known outage.',
        });
      case status >= 500:
        // We genuinely don't know what broke — say so.
        return out({
          kind: 'server', known: false, retryable: true,
          headline: 'Something went wrong on our side',
          why: "The server hit an unexpected problem, and we don't know exactly what caused it. It isn't something you did wrong.",
          fix: 'Try again in a minute. If it keeps happening, contact support and quote the reference below so we can look into it.',
        });
      default:
        return out({
          kind: 'unknown', known: false,
          headline: 'Something went wrong',
          why: srv || `The server replied with an unexpected response (${status}), and we don't know why.`,
          fix: 'Try again. If it keeps happening, contact support and quote the reference below.',
        });
    }
  }

  // ── Anything else: honest "we don't know" ──
  return out({
    kind: 'unknown', known: false,
    headline: 'Something went wrong',
    why: "We don't know exactly what caused this.",
    fix: 'Try again, or refresh the page. If it keeps happening, contact support and quote the reference below.',
  });
}

/** Headlines that tell the person nothing — the explainer's own headline replaces them. */
export const BLAND_TITLE = /^(failed|error|action failed|load error|something went wrong|failed to load|an error occurred|oops)[.!]?$/i;

/** Does a bare string look like a failure (vs. a validation hint like "Pick a template first")? */
export const LOOKS_LIKE_FAILURE = /fail|could not|couldn['’]?t|can['’]?t|unable|error|went wrong|timed? ?out|denied|not found|not (saved|sent|loaded|updated|created)|damaged/i;
