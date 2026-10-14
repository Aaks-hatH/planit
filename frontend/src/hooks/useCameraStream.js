/**
 * hooks/useCameraStream.js
 *
 * Minimal front-facing camera stream manager for selfie-style capture flows
 * (Face Ticket enroll + verify). Separate from the html5-qrcode-driven QR
 * scanner used elsewhere in the app — this one just needs a raw <video> feed
 * for face-api.js to read frames from, no barcode decoding.
 *
 * Hardened for mobile:
 *  - Detects insecure contexts (getUserMedia requires HTTPS or localhost —
 *    on a phone hitting a plain http:// LAN IP, `navigator.mediaDevices` is
 *    undefined and every call would throw a confusing TypeError).
 *  - Falls back through a chain of constraints instead of one fixed set,
 *    since `facingMode: 'user'` combined with a tight ideal resolution can
 *    hit OverconstrainedError on some Android front cameras.
 *  - Waits for the <video> element to actually exist before attaching the
 *    stream (it can be one tick behind on a fast remount) instead of
 *    silently dropping the stream when videoRef.current is still null.
 *  - stop() fully releases the hardware track *and* clears the <video>'s
 *    srcObject, so a subsequent start() is guaranteed to produce a fresh,
 *    playing stream rather than an attached-but-dead one.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

function mapCameraError(err) {
  if (err?.message === 'INSECURE_CONTEXT') {
    return 'Camera access needs a secure connection (https://) \u2014 open this page over HTTPS or via localhost.';
  }
  if (err?.message === 'UNSUPPORTED') {
    return 'This browser doesn\u2019t support camera access. Try the latest Chrome or Safari.';
  }
  if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
    return 'Camera permission denied. Allow camera access in your browser\u2019s address bar or site settings, then retry.';
  }
  if (err.name === 'NotFoundError' || err.message?.includes('device not found')) {
    return 'No camera found on this device.';
  }
  if (err.name === 'NotReadableError' || err.message?.includes('in use')) {
    return 'Camera is in use by another app. Close it and try again.';
  }
  if (err.name === 'OverconstrainedError') {
    return 'Camera settings not supported on this device.';
  }
  return `Could not start the camera. ${err.message || 'Please check permissions and try again.'}`;
}

// Waits up to ~2s for a ref to be attached (handles the remount race where
// start() fires before React has committed the <video> element to the DOM).
async function waitForRef(ref, timeoutMs = 2000) {
  const step = 30;
  let waited = 0;
  while (!ref.current && waited < timeoutMs) {
    await new Promise((r) => setTimeout(r, step));
    waited += step;
  }
  return ref.current;
}

// Constraint fallback chain: try a reasonable ideal resolution first, then
// relax progressively. Mobile front cameras vary wildly in what they'll
// accept alongside facingMode, especially at the low end and on older
// Android WebViews.
const CONSTRAINT_CHAIN = [
  { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
  { facingMode: 'user' },
  { facingMode: { ideal: 'user' } },
  true, // last resort: whatever camera the browser gives us
];

async function acquireStream() {
  let lastErr = null;
  for (const video of CONSTRAINT_CHAIN) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (err) {
      lastErr = err;
      // Permission denial won't be fixed by relaxing constraints — stop early.
      if (err.name === 'NotAllowedError') throw err;
    }
  }
  throw lastErr;
}

export function useCameraStream() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const startTokenRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    startTokenRef.current += 1; // invalidate any in-flight start()
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
      if (typeof window === 'undefined' || !window.isSecureContext) {
        throw new Error('INSECURE_CONTEXT');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED');
      }

      // Release any stale track before requesting a new one — some mobile
      // browsers won't hand out a second stream while an old one (even a
      // stopped one still referenced by srcObject) is attached.
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await acquireStream();
      if (token !== startTokenRef.current) {
        // A newer start()/stop() happened while we were awaiting permission —
        // discard this stream instead of attaching a now-stale one.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      const videoEl = videoRef.current || (await waitForRef(videoRef));
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
      console.error('Camera start failed', err);
      setError(mapCameraError(err));
      setReady(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, ready, error, start, stop };
}
