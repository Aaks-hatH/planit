/**
 * components/QrScanner.jsx
 *
 * One shared, hardened QR scanner used everywhere in the app (door check-in,
 * table service, QR Pass, Face Ticket). Works on desktop webcams and phones.
 *
 * What it fixes compared to the per-page copies it replaces:
 *  - Desktop: no `facingMode: {exact: 'environment'}` (webcams can't satisfy
 *    it). Tries a soft rear-camera preference, then the front camera, then
 *    every enumerated device, so it never dead-ends.
 *  - Race-free: every start/stop goes through one queue, and a generation
 *    counter aborts a start that was superseded (React StrictMode double
 *    mount, quick Back/Retry taps). No more "camera stays on" / "camera in
 *    use" after leaving the screen.
 *  - Full cleanup: stop() + clear(), and any leftover tracks are released.
 *  - Accuracy: asks for a 720p stream (default is often 640x480, too soft
 *    for dense QR codes), continuous autofocus, and runs the browser's
 *    native BarcodeDetector over the *whole frame* alongside the ZXing
 *    decoder where supported.
 *  - Controls: torch (where the camera has one), switch camera (remembers
 *    the choice), and "scan from a photo" as a fallback when the camera is
 *    blocked or the code is hard to read.
 *  - Clear errors: insecure (http://) context, permission denied, no camera,
 *    camera busy, timeout, each with a Retry.
 *
 * Props:
 *   onScan(text)   called with the decoded text.
 *   continuous     keep scanning after a hit (default false: the camera is
 *                  released first, then onScan fires, so the caller can
 *                  swap the UI without fighting the camera).
 *   allowUpload    show the "scan from photo" option (default true).
 *   hint           small caption under the viewfinder.
 *   className      classes for the outer wrapper.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CameraOff, Flashlight, FlashlightOff, Loader2, RefreshCw, SwitchCamera, Upload } from 'lucide-react';

const PREF_KEY = 'planit.qr.camera';
const START_TIMEOUT_MS = 15000;
const DEDUPE_MS = 2500;
const SCANNING = 2;
const PAUSED = 3;

const readPref = () => { try { return localStorage.getItem(PREF_KEY) || null; } catch { return null; } };
const writePref = (id) => {
  try { id ? localStorage.setItem(PREF_KEY, id) : localStorage.removeItem(PREF_KEY); } catch { /* storage blocked */ }
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error('Camera start timed out'), { name: 'TimeoutError' })), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

function describeError(err) {
  const name = err?.name || '';
  const msg = String(err?.message || err || '');
  if (msg === 'INSECURE_CONTEXT') return 'Camera access needs a secure connection. Open this page over https:// (or localhost).';
  if (msg === 'UNSUPPORTED') return 'This browser can’t access the camera. Try the latest Chrome, Edge, Firefox or Safari.';
  if (name === 'NotAllowedError' || /permission|denied/i.test(msg)) {
    return 'Camera permission is blocked. Allow camera access for this site (look for the camera icon in the address bar), then tap Retry.';
  }
  if (name === 'NotFoundError' || msg === 'NO_CAMERAS' || /device not found|requested device/i.test(msg)) {
    return 'No camera found on this device. You can scan from a photo instead.';
  }
  if (name === 'NotReadableError' || /in use|could not start video/i.test(msg)) {
    return 'The camera is being used by another app or tab. Close it, then tap Retry.';
  }
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout/i.test(msg)) {
    return 'The camera took too long to start. Close other apps using it, then tap Retry.';
  }
  if (name === 'OverconstrainedError') return 'This camera doesn’t support the requested settings. Tap Retry to try another camera.';
  return `Could not start the camera. ${msg || 'Please check permissions and try again.'}`;
}

async function makeNativeDetector() {
  try {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
    const formats = await window.BarcodeDetector.getSupportedFormats?.();
    if (formats && !formats.includes('qr_code')) return null;
    return new window.BarcodeDetector({ formats: ['qr_code'] });
  } catch {
    return null;
  }
}

const STYLES = `
.qrs-reader{border:0!important;padding:0!important;width:100%;min-height:100%}
.qrs-reader video{display:block;width:100%!important;height:auto!important}
.qrs-reader #qr-shaded-region{display:none!important}
.qrs-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;container-type:size}
.qrs-frame{position:relative;width:70%;aspect-ratio:1/1}
@supports (width:1cqmin){.qrs-frame{width:75cqmin}}
.qrs-c{position:absolute;width:11%;height:11%;border:3px solid #fff;filter:drop-shadow(0 0 4px rgba(0,0,0,.6))}
.qrs-tl{top:0;left:0;border-right:0;border-bottom:0;border-top-left-radius:14px}
.qrs-tr{top:0;right:0;border-left:0;border-bottom:0;border-top-right-radius:14px}
.qrs-bl{bottom:0;left:0;border-right:0;border-top:0;border-bottom-left-radius:14px}
.qrs-br{bottom:0;right:0;border-left:0;border-top:0;border-bottom-right-radius:14px}
.qrs-line{position:absolute;left:6%;right:6%;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,#5eead4,transparent);box-shadow:0 0 10px #5eead4;animation:qrs-sweep 2.2s ease-in-out infinite alternate}
@keyframes qrs-sweep{from{top:8%}to{top:92%}}
@media (prefers-reduced-motion:reduce){.qrs-line{animation:none;top:50%}}
`;

export default function QrScanner({
  onScan,
  continuous = false,
  allowUpload = true,
  hint = 'Hold the QR code inside the frame. It scans automatically.',
  className = '',
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const readerId = `qrs-${uid}`;
  const fileReaderId = `qrs-file-${uid}`;

  const rootRef = useRef(null);
  const fileInputRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const scannerRef = useRef(null);
  const timerRef = useRef(null);
  const trackRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const genRef = useRef(0);          // bumped on every start/stop request
  const mountedRef = useRef(true);
  const lastHitRef = useRef({ text: '', at: 0 });
  const firedRef = useRef(false);

  const [status, setStatus] = useState('starting'); // starting | running | error
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [photoMsg, setPhotoMsg] = useState(null);

  const enqueue = useCallback((fn) => {
    const next = queueRef.current.then(fn, fn);
    queueRef.current = next.catch(() => {});
    return next;
  }, []);

  // ── teardown (runs inside the queue) ───────────────────────────────────
  const teardown = useCallback(async () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    const scanner = scannerRef.current;
    const track = trackRef.current;
    scannerRef.current = null;
    trackRef.current = null;
    if (scanner) {
      try {
        const st = scanner.getState?.();
        if (st === SCANNING || st === PAUSED) await scanner.stop();
      } catch { /* not running */ }
      try { scanner.clear(); } catch { /* nothing rendered */ }
    }
    try { track?.stop(); } catch { /* already stopped */ }
    // Belt and braces: release anything still attached to a leftover <video>.
    try {
      rootRef.current?.querySelectorAll('video').forEach((v) => {
        v.srcObject?.getTracks?.().forEach((t) => t.stop());
        v.srcObject = null;
      });
    } catch { /* ignore */ }
    const el = document.getElementById(readerId);
    if (el) el.innerHTML = '';
  }, [readerId]);

  const stop = useCallback(() => {
    genRef.current += 1; // abort any in-flight start
    return enqueue(teardown);
  }, [enqueue, teardown]);

  // ── a decoded value arrives (from either decoder) ──────────────────────
  const handleDecoded = useCallback((raw) => {
    const text = typeof raw === 'string' ? raw : '';
    if (!text.trim() || !mountedRef.current) return;
    const now = Date.now();
    const last = lastHitRef.current;
    if (text === last.text && now - last.at < DEDUPE_MS) return;
    lastHitRef.current = { text, at: now };
    try { navigator.vibrate?.(60); } catch { /* unsupported */ }

    if (continuous) {
      onScanRef.current?.(text);
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;
    // Release the camera first, then hand over, so the caller's next screen
    // never fights this one for the hardware.
    stop().finally(() => {
      if (mountedRef.current) setStatus('stopped');
      onScanRef.current?.(text);
    });
  }, [continuous, stop]);

  // ── start (runs inside the queue) ──────────────────────────────────────
  const startInner = useCallback(async (gen, preferredId) => {
    const stale = () => gen !== genRef.current || !mountedRef.current;
    try {
      if (typeof window === 'undefined' || !window.isSecureContext) throw new Error('INSECURE_CONTEXT');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (stale()) return;

      await teardown(); // start from a clean slate
      if (stale()) return;

      const config = {
        fps: 12,
        // ZXing only decodes inside this box, so keep it generous. The
        // native detector below scans the whole frame regardless.
        qrbox: (w, h) => {
          const side = Math.max(120, Math.floor(Math.min(w, h) * 0.85));
          return { width: side, height: side };
        },
        disableFlip: true, // QR codes aren't mirrored; halves the decode work
      };
      const onZxingHit = (text) => handleDecoded(text);
      const noop = () => {};

      const tryStart = async (cameraIdOrConfig) => {
        const el = document.getElementById(readerId);
        if (el) el.innerHTML = '';
        const scanner = new Html5Qrcode(readerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: false }, // we run our own native pass
        });
        scannerRef.current = scanner;
        try {
          await withTimeout(scanner.start(cameraIdOrConfig, config, onZxingHit, noop), START_TIMEOUT_MS);
        } catch (err) {
          scannerRef.current = null;
          try { if (scanner.getState?.() === SCANNING) await scanner.stop(); } catch { /* ignore */ }
          try { scanner.clear(); } catch { /* ignore */ }
          throw err;
        }
        return scanner;
      };

      // Camera fallback chain. Never `exact:` a facing mode — desktop webcams
      // and many Android devices can't satisfy it.
      const attempts = [];
      if (preferredId) attempts.push(preferredId);
      attempts.push({ facingMode: 'environment' });
      attempts.push({ facingMode: 'user' });

      let started = false;
      let lastErr = null;
      for (const attempt of attempts) {
        if (stale()) return;
        try { await tryStart(attempt); started = true; break; }
        catch (err) {
          lastErr = err;
          if (err?.name === 'NotAllowedError' || /permission|denied/i.test(String(err?.message))) break;
        }
      }
      if (!started && lastErr?.name !== 'NotAllowedError') {
        // Last resort: walk every enumerated device.
        try {
          const list = await Html5Qrcode.getCameras();
          for (const cam of list || []) {
            if (stale()) return;
            try { await tryStart(cam.id); started = true; break; } catch (err) { lastErr = err; }
          }
        } catch (err) { lastErr = lastErr || err; }
      }
      if (!started) throw lastErr || new Error('NO_CAMERAS');

      if (stale()) { await teardown(); return; }

      // ── post-start tuning (all best-effort) ────────────────────────────
      const videoEl = document.getElementById(readerId)?.querySelector('video') || null;
      const track = videoEl?.srcObject?.getVideoTracks?.()[0] || null;
      trackRef.current = track;

      if (track) {
        try {
          const caps = track.getCapabilities?.() || {};
          const settings = track.getSettings?.() || {};
          setTorchOk(!!caps.torch);
          setTorchOn(false);
          if (settings.deviceId) {
            setActiveId(settings.deviceId);
            writePref(settings.deviceId);
          }
          // A sharper stream decodes dense codes far more reliably than the
          // 640x480 many browsers hand out by default.
          if ((settings.width || 0) < 1000 && (caps.width?.max || 0) >= 1280) {
            await track.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 } }).catch(() => {});
          }
          if (caps.focusMode?.includes?.('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
          }
        } catch { /* optional tuning */ }
      }

      // Native detector over the whole frame, in parallel with ZXing.
      const detector = await makeNativeDetector();
      if (stale()) { await teardown(); return; }
      if (detector && videoEl) {
        let busy = false;
        timerRef.current = setInterval(async () => {
          if (busy || document.hidden || videoEl.readyState < 2) return;
          busy = true;
          try {
            const found = await detector.detect(videoEl);
            if (found?.[0]?.rawValue) handleDecoded(found[0].rawValue);
          } catch { /* frame not ready */ }
          finally { busy = false; }
        }, 140);
      }

      // Camera list for the switch button (labels are available post-permission).
      try {
        const list = await Html5Qrcode.getCameras();
        if (!stale()) setCameras(list || []);
      } catch { /* ignore */ }

      if (!stale()) { setStatus('running'); setError(null); }
    } catch (err) {
      if (stale()) return;
      console.error('QR scanner start failed', err);
      await teardown();
      if (mountedRef.current) { setError(describeError(err)); setStatus('error'); }
    }
  }, [handleDecoded, readerId, teardown]);

  const start = useCallback((preferredId) => {
    const gen = ++genRef.current;
    firedRef.current = false;
    setStatus('starting');
    setError(null);
    return enqueue(() => startInner(gen, preferredId ?? readPref()));
  }, [enqueue, startInner]);

  useEffect(() => {
    mountedRef.current = true;
    start();
    return () => {
      mountedRef.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── controls ───────────────────────────────────────────────────────────
  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch { setTorchOk(false); }
  };

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.id === activeId);
    const next = cameras[(idx + 1) % cameras.length];
    writePref(next.id);
    setTorchOn(false);
    start(next.id);
  };

  const scanPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyUpload(true);
    setPhotoMsg(null);
    try {
      let text = null;
      const detector = await makeNativeDetector();
      if (detector && typeof createImageBitmap === 'function') {
        try {
          const bmp = await createImageBitmap(file);
          const found = await detector.detect(bmp);
          bmp.close?.();
          text = found?.[0]?.rawValue || null;
        } catch { /* fall through to ZXing */ }
      }
      if (!text) {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        const fileScanner = new Html5Qrcode(fileReaderId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        try { text = await fileScanner.scanFile(file, false); }
        finally { try { fileScanner.clear(); } catch { /* ignore */ } }
      }
      if (text) {
        lastHitRef.current = { text: '', at: 0 };
        firedRef.current = false;
        handleDecoded(text);
      }
    } catch {
      setPhotoMsg('No QR code found in that photo. Try a sharper, closer shot with the whole code in frame.');
    } finally {
      setBusyUpload(false);
    }
  };

  const showError = status === 'error';
  const controlBtn =
    'w-11 h-11 rounded-full bg-black/55 backdrop-blur border border-white/20 text-white flex items-center justify-center active:scale-95 hover:bg-black/70 disabled:opacity-50';

  return (
    <div className={`w-full ${className}`}>
      <style>{STYLES}</style>

      <div
        ref={rootRef}
        className="relative w-full overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl"
        style={{ minHeight: 260 }}
      >
        {/* html5-qrcode mounts its <video> here. DO NOT REMOVE. */}
        <div id={readerId} className="qrs-reader" />

        {status === 'running' && (
          <div className="qrs-overlay" aria-hidden="true">
            <div className="qrs-frame">
              <span className="qrs-c qrs-tl" /><span className="qrs-c qrs-tr" />
              <span className="qrs-c qrs-bl" /><span className="qrs-c qrs-br" />
              <span className="qrs-line" />
            </div>
          </div>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-300 text-sm gap-3 bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-teal-300" />
            Starting camera&hellip;
          </div>
        )}

        {showError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black text-white overflow-auto">
            <CameraOff className="w-12 h-12 mb-3 text-rose-400" />
            <p className="text-sm text-neutral-300 mb-5 max-w-xs">{error}</p>
            <div className="flex flex-col gap-2.5 w-full max-w-[16rem]">
              <button
                onClick={() => start()}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-white text-black text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-200"
              >
                <RefreshCw className="w-4 h-4" /> Retry camera
              </button>
              {allowUpload && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busyUpload}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl border border-white/20 text-sm text-neutral-200 inline-flex items-center justify-center gap-2 hover:bg-white/5 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" /> Scan from a photo
                </button>
              )}
            </div>
          </div>
        )}

        {status === 'running' && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
            {torchOk && (
              <button onClick={toggleTorch} className={controlBtn} aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}>
                {torchOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
              </button>
            )}
            {cameras.length > 1 && (
              <button onClick={switchCamera} className={controlBtn} aria-label="Switch camera">
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}
            {allowUpload && (
              <button onClick={() => fileInputRef.current?.click()} disabled={busyUpload} className={controlBtn} aria-label="Scan from a photo">
                {busyUpload ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {photoMsg && <p className="text-center text-rose-300 text-xs mt-3">{photoMsg}</p>}
      {status !== 'error' && !photoMsg && hint && <p className="text-center text-neutral-400 text-xs mt-3">{hint}</p>}

      {/* Offscreen host for photo scanning (kept separate from the live reader) */}
      <div id={fileReaderId} style={{ display: 'none' }} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={scanPhoto} />
    </div>
  );
}
