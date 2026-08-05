// ═══════════════════════════════════════════════════════════════════════════
// VENUE WALK — core logic (dead-reckoning position tracking)
//
// Everything in this file runs entirely client-side. No step, heading,
// frame, or table position is ever sent to a server — this module never
// imports `api.js` or makes a network call of any kind. Table layouts are
// read and written straight to this browser's localStorage (see the
// "STORAGE" section below), the same way Face Ticket keeps face embeddings
// out of any backend.
//
// Pipeline:
//   walk venue once -> accelerometer step detection + compass heading
//                    -> dead-reckoned {x, y} trail, meters from the start point
//                    -> drop pins at table positions -> persist {name, x, y}[]
//
//   guest re-walk    -> same step+heading tracking from the same start point
//                    -> bearingTo() + distanceBetween() against the assigned
//                       table's stored {x, y} -> live arrow + distance readout
//
// This is dead-reckoning, not GPS and not true AR anchoring: every step
// estimate compounds a little error onto the last one, so drift grows with
// distance walked. It is an estimate, not precision positioning — flagged
// in the BetaBar copy in VenueWalk.jsx the same way Face Ticket flags its
// liveness check as best-effort, not spoof-proof.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Tuning constants ──────────────────────────────────────────────────────
const DEFAULT_STRIDE_M = 0.7;          // average adult walking stride, meters
const STEP_THRESHOLD = 1.6;            // m/s^2 above rolling average to count as a step
const STEP_DEBOUNCE_MS = 300;          // minimum gap between counted steps
const ROLLING_WINDOW = 12;             // samples averaged for the noise floor
const MIN_SAMPLES_BEFORE_DETECT = 6;   // let the rolling average settle first
const PERMISSION_TIMEOUT_MS = 15000;   // iOS permission dialog is user-paced; generous
// If motion/orientation events never actually arrive after we start listening
// (permission silently no-op'd, a WebView that reports the API but has no
// hardware behind it, a laptop with no accelerometer at all), the screen
// must not sit there looking "active" with a frozen readout forever.
const FIRST_EVENT_TIMEOUT_MS = 4000;

// ─── Shared timeout guard (same pattern as faceTicket.js) ─────────────────
// A permission prompt or a sensor subscription should never be able to hang
// this UI in a silent stuck state — every async call that can stall is
// raced against a hard timeout, same as Face Ticket's detection calls.
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Feature detection (never user-agent sniffing) ────────────────────────
/** True if the platform exposes the motion/orientation event APIs at all.
 *  This is a necessary check, not a sufficient one — some browsers expose
 *  the constructors but never actually fire events on hardware without an
 *  accelerometer/compass, which is why every hook below *also* runs a
 *  first-event arrival timeout before declaring itself usable. */
export function motionSensorsSupported() {
  return (
    typeof window !== 'undefined' &&
    'DeviceMotionEvent' in window &&
    'DeviceOrientationEvent' in window
  );
}

/** iOS 13+ gates both DeviceMotionEvent and DeviceOrientationEvent behind an
 *  explicit permission prompt, and — critically — that prompt only appears
 *  if requestPermission() is called synchronously-ish from within a user
 *  gesture handler (a tap). Other browsers (desktop Chrome/Firefox, most
 *  Android) don't define requestPermission at all, so each call here is
 *  feature-detected rather than gated on platform sniffing. */
export async function requestMotionPermission() {
  const need = (Ctor) => typeof Ctor !== 'undefined' && typeof Ctor.requestPermission === 'function';

  if (need(window.DeviceMotionEvent)) {
    const result = await withTimeout(
      window.DeviceMotionEvent.requestPermission(),
      PERMISSION_TIMEOUT_MS,
      'Motion permission prompt',
    );
    if (result !== 'granted') throw new Error('denied');
  }
  if (need(window.DeviceOrientationEvent)) {
    const result = await withTimeout(
      window.DeviceOrientationEvent.requestPermission(),
      PERMISSION_TIMEOUT_MS,
      'Orientation permission prompt',
    );
    if (result !== 'granted') throw new Error('denied');
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// useStepTracker — accelerometer-based step detection
// ═══════════════════════════════════════════════════════════════════════════
/** Detects footsteps from `devicemotion` acceleration magnitude: a rolling
 *  average establishes the current noise floor, a threshold crossing above
 *  that floor (with a debounce so a single footfall's shock doesn't get
 *  double-counted) increments the step count. Returns a controller object —
 *  call start() from a tap (needed for the iOS permission gesture) and
 *  stop() to release the listener. */
export function useStepTracker({ onUnavailable } = {}) {
  const [stepCount, setStepCount] = useState(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);

  const handlerRef = useRef(null);
  const windowRef = useRef([]);
  const lastStepAtRef = useRef(0);
  const gotFirstEventRef = useRef(false);
  const firstEventTimerRef = useRef(null);

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener('devicemotion', handlerRef.current);
      handlerRef.current = null;
    }
    if (firstEventTimerRef.current) {
      clearTimeout(firstEventTimerRef.current);
      firstEventTimerRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    windowRef.current = [];
    lastStepAtRef.current = 0;
    gotFirstEventRef.current = false;

    if (!motionSensorsSupported()) {
      setError('UNSUPPORTED');
      onUnavailable?.('UNSUPPORTED');
      return;
    }

    try {
      await requestMotionPermission();
    } catch (err) {
      const code = err?.message === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_FAILED';
      setError(code);
      onUnavailable?.(code);
      return;
    }

    const handler = (event) => {
      gotFirstEventRef.current = true;
      const a = event.accelerationIncludingGravity || event.acceleration;
      if (!a || a.x === null || a.x === undefined) return;

      const magnitude = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const win = windowRef.current;
      win.push(magnitude);
      if (win.length > ROLLING_WINDOW) win.shift();
      if (win.length < MIN_SAMPLES_BEFORE_DETECT) return;

      const avg = win.reduce((s, v) => s + v, 0) / win.length;
      const now = performance.now();
      const crossedThreshold = magnitude > avg + STEP_THRESHOLD;
      const debounced = now - lastStepAtRef.current > STEP_DEBOUNCE_MS;

      if (crossedThreshold && debounced) {
        lastStepAtRef.current = now;
        setStepCount((c) => c + 1);
      }
    };

    handlerRef.current = handler;
    window.addEventListener('devicemotion', handler);
    setActive(true);

    // Guard against permission having silently no-op'd (some in-app
    // WebViews grant the prompt but never actually deliver events) — if
    // nothing arrives in time, fall back instead of leaving the tracker
    // looking "active" with a permanently frozen step count.
    firstEventTimerRef.current = setTimeout(() => {
      if (!gotFirstEventRef.current) {
        stop();
        setError('NO_SENSOR_DATA');
        onUnavailable?.('NO_SENSOR_DATA');
      }
    }, FIRST_EVENT_TIMEOUT_MS);
  }, [onUnavailable, stop]);

  useEffect(() => () => stop(), [stop]);

  const resetSteps = useCallback(() => setStepCount(0), []);

  return { stepCount, active, error, start, stop, resetSteps };
}

// ═══════════════════════════════════════════════════════════════════════════
// useHeading — compass heading from DeviceOrientationEvent
// ═══════════════════════════════════════════════════════════════════════════
/** Heading in degrees, 0-360, clockwise. Prefers iOS's `webkitCompassHeading`
 *  (already true-heading, clockwise) since the standards-track `alpha`
 *  field's zero-point is just "wherever the device was pointed when
 *  listening started" and its rotation direction varies by browser — alpha
 *  is only used as a fallback, converted to a clockwise 0-360 value. */
export function useHeading({ onUnavailable } = {}) {
  const [heading, setHeading] = useState(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);

  const handlerRef = useRef(null);
  const gotFirstEventRef = useRef(false);
  const firstEventTimerRef = useRef(null);

  const stop = useCallback(() => {
    if (handlerRef.current) {
      window.removeEventListener('deviceorientation', handlerRef.current);
      handlerRef.current = null;
    }
    if (firstEventTimerRef.current) {
      clearTimeout(firstEventTimerRef.current);
      firstEventTimerRef.current = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    gotFirstEventRef.current = false;

    if (!motionSensorsSupported()) {
      setError('UNSUPPORTED');
      onUnavailable?.('UNSUPPORTED');
      return;
    }

    try {
      await requestMotionPermission();
    } catch (err) {
      const code = err?.message === 'denied' ? 'PERMISSION_DENIED' : 'PERMISSION_FAILED';
      setError(code);
      onUnavailable?.(code);
      return;
    }

    const handler = (event) => {
      gotFirstEventRef.current = true;
      let deg;
      if (typeof event.webkitCompassHeading === 'number') {
        deg = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number') {
        deg = (360 - event.alpha) % 360;
      } else {
        return;
      }
      setHeading(deg);
    };

    handlerRef.current = handler;
    window.addEventListener('deviceorientation', handler);
    setActive(true);

    firstEventTimerRef.current = setTimeout(() => {
      if (!gotFirstEventRef.current) {
        stop();
        setError('NO_SENSOR_DATA');
        onUnavailable?.('NO_SENSOR_DATA');
      }
    }, FIRST_EVENT_TIMEOUT_MS);
  }, [onUnavailable, stop]);

  useEffect(() => () => stop(), [stop]);

  return { heading, active, error, start, stop };
}

// ═══════════════════════════════════════════════════════════════════════════
// usePositionTracker — combines steps + heading into a running {x, y}
// ═══════════════════════════════════════════════════════════════════════════
/** x/y are meters from wherever reset() was last called (the "anchor" —
 *  the entrance, or wherever Setup/Find mode told the person to stand).
 *  On every newly-detected step, advances position by strideLength in the
 *  direction of the heading *at that moment*. */
export function usePositionTracker({ strideLength = DEFAULT_STRIDE_M, onUnavailable } = {}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastCountedStepRef = useRef(0);
  const headingRef = useRef(0);

  const steps = useStepTracker({ onUnavailable });
  const compass = useHeading({ onUnavailable });

  headingRef.current = compass.heading ?? headingRef.current;

  useEffect(() => {
    // Reading the heading through a ref (rather than depending on
    // `compass.heading` directly) is deliberate: compass events fire far
    // more often than step events, and this effect must run exactly once
    // per newly detected step — not once per compass tick — or a step would
    // get applied multiple times as the heading wobbles.
    if (steps.stepCount > lastCountedStepRef.current) {
      const delta = steps.stepCount - lastCountedStepRef.current;
      lastCountedStepRef.current = steps.stepCount;
      const rad = (headingRef.current * Math.PI) / 180;
      setPosition((p) => ({
        x: p.x + delta * strideLength * Math.sin(rad),
        y: p.y + delta * strideLength * Math.cos(rad),
      }));
    }
  }, [steps.stepCount, strideLength]);

  const start = useCallback(async () => {
    await steps.start();
    await compass.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    steps.stop();
    compass.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setPosition({ x: 0, y: 0 });
    lastCountedStepRef.current = 0;
    steps.resetSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    position,
    heading: compass.heading,
    stepCount: steps.stepCount,
    active: steps.active && compass.active,
    error: steps.error || compass.error,
    start,
    stop,
    reset,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// useVenueCamera — rear-camera passthrough for the AR-style overlay
// ═══════════════════════════════════════════════════════════════════════════
// Deliberately separate from hooks/useCameraStream.js: that hook is tuned
// for front-facing selfie capture (Face Ticket's enroll/verify). Venue Walk
// wants the *rear* camera as a passthrough backdrop, so it gets its own
// constraint chain, but keeps the same hardening: insecure-context and
// unsupported checks, a fallback chain instead of one fixed constraint set,
// a stale-track release before requesting a new stream, and a stop() that
// fully tears down the track so a re-entrant start() is never left attached
// to a dead stream.
const REAR_CONSTRAINT_CHAIN = [
  { facingMode: { exact: 'environment' } },
  { facingMode: 'environment' },
  { facingMode: 'user' }, // last resort on devices with only one camera
  true,
];

function mapVenueCameraError(err) {
  if (err?.message === 'INSECURE_CONTEXT') {
    return 'Camera access needs a secure connection (https://) \u2014 open this page over HTTPS or via localhost.';
  }
  if (err?.message === 'UNSUPPORTED') {
    return 'This browser doesn\u2019t support camera access. Try the latest Chrome or Safari.';
  }
  if (err?.name === 'NotAllowedError') {
    return 'Camera permission denied. Allow camera access in your browser\u2019s site settings, then retry.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No camera found on this device.';
  }
  if (err?.name === 'NotReadableError') {
    return 'Camera is in use by another app. Close it and try again.';
  }
  return `Could not start the camera. ${err?.message || 'Please check permissions and try again.'}`;
}

async function waitForVideoRef(ref, timeoutMs = 2000) {
  const step = 30;
  let waited = 0;
  while (!ref.current && waited < timeoutMs) {
    await new Promise((r) => setTimeout(r, step));
    waited += step;
  }
  return ref.current;
}

export function useVenueCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const startTokenRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause?.();
      videoRef.current.srcObject = null;
    }
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    const token = ++startTokenRef.current;
    setError(null);
    setReady(false);

    try {
      if (typeof window === 'undefined' || !window.isSecureContext) throw new Error('INSECURE_CONTEXT');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      let stream = null;
      let lastErr = null;
      for (const video of REAR_CONSTRAINT_CHAIN) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
          break;
        } catch (err) {
          lastErr = err;
          if (err.name === 'NotAllowedError') throw err; // relaxing constraints won't fix a denial
        }
      }
      if (!stream) throw lastErr || new Error('Could not start the camera.');

      if (token !== startTokenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const videoEl = videoRef.current || (await waitForVideoRef(videoRef));
      if (!videoEl || token !== startTokenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }

      videoEl.srcObject = stream;
      await videoEl.play();
      if (token !== startTokenRef.current) return;
      setReady(true);
    } catch (err) {
      if (token !== startTokenRef.current) return;
      console.error('Venue camera start failed', err);
      setError(mapVenueCameraError(err));
      setReady(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, ready, error, start, stop };
}

// ═══════════════════════════════════════════════════════════════════════════
// Pure trig helpers — plain functions, unit-testable, no React/DOM
// ═══════════════════════════════════════════════════════════════════════════
/** Bearing from point `a` to point `b`, in degrees clockwise from 0
 *  ("north" as defined by wherever the dead-reckoning anchor was set). */
export function bearingTo(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Straight-line distance between two {x, y} points, in the same units
 *  they're stored in (meters, throughout this feature). */
export function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Signed difference from `currentHeading` to `targetBearing`, in the
 *  -180..180 range (negative = target is to the left). */
export function relativeBearing(currentHeading, targetBearing) {
  return ((targetBearing - currentHeading + 540) % 360) - 180;
}

/** Plain-language steering hint for the FindMode readout. */
export function bearingLabel(currentHeading, targetBearing) {
  const diff = relativeBearing(currentHeading, targetBearing);
  if (Math.abs(diff) < 12) return 'straight ahead';
  return diff > 0 ? 'bear right' : 'bear left';
}

export function metersToFeet(meters) {
  return meters * 3.28084;
}

/** Rounded, human readout for the live distance chip — "Arrived" once close
 *  enough that dead-reckoning drift makes finer numbers meaningless. */
export function formatDistance(meters) {
  const feet = metersToFeet(meters);
  if (feet < 4) return 'Arrived';
  if (feet < 30) return `${Math.round(feet)} ft`;
  return `${Math.round(feet / 3) * 3} ft`; // coarser rounding further out, matching drift growth
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE — browser-local venue layouts, nothing ever sent to a server
// ═══════════════════════════════════════════════════════════════════════════
const STORAGE_PREFIX = 'planit_venue_walk_layout_';
const LAYOUT_VERSION = 1;

/** Persists a venue's table positions to this browser's localStorage only.
 *  `tables` is an array of {name, x, y} — the exact same shape whether it
 *  came from a physical walk or the FloorPlanFallback's click-to-place. */
export function saveVenueLayout(venueId, tables) {
  try {
    const payload = { v: LAYOUT_VERSION, tables, savedAt: Date.now() };
    localStorage.setItem(`${STORAGE_PREFIX}${venueId}`, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Could not save venue layout', err);
    return false;
  }
}

export function loadVenueLayout(venueId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${venueId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tables)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteVenueLayout(venueId) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${venueId}`);
    return true;
  } catch {
    return false;
  }
}

/** Lists every venue layout saved on this device, most recent first — used
 *  by the "Find My Table" venue picker. */
export function listSavedVenues() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const venueId = key.slice(STORAGE_PREFIX.length);
      const data = loadVenueLayout(venueId);
      if (data) out.push({ venueId, tableCount: data.tables.length, savedAt: data.savedAt });
    }
  } catch {
    /* localStorage unavailable (private mode, quota) — just show none saved */
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function defaultVenueId() {
  return 'default';
}
