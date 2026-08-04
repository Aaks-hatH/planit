/**
 * hooks/useCameraStream.js
 *
 * Minimal front-facing camera stream manager for selfie-style capture flows
 * (Face Ticket enroll + verify). Separate from the html5-qrcode-driven QR
 * scanner used elsewhere in the app — this one just needs a raw <video> feed
 * for face-api.js to read frames from, no barcode decoding.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

function mapCameraError(err) {
  if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
    return 'Camera permission denied. Allow camera access in your browser\u2019s address bar, then try again.';
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

export function useCameraStream() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    setError(null);
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (err) {
      setError(mapCameraError(err));
      setReady(false);
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, ready, error, start, stop };
}
