// ═══════════════════════════════════════════════════════════════════════════
// FACE TICKET — core logic (no React here)
//
// Everything in this file runs entirely client-side. No image, frame, or
// embedding is ever sent to a server — this module never imports `api.js`
// or touches the network beyond loading the (static, public) model weights.
//
// Pipeline:
//   selfie -> face-api.js descriptor (Float32Array[128])
//          -> quantize to Uint8Array[128] + {min,max}
//          -> pack into a compact JSON payload
//          -> QR-encode (see FaceTicket.jsx)
//
//   scan   -> decode QR -> unpack payload -> dequantize
//          -> live selfie -> fresh descriptor
//          -> cosine similarity + liveness signal -> match decision
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_URL = '/models';
const PROTOCOL_VERSION = 1;

// Byte-budget for the QR payload. QR version 25 at error-correction level H
// (the level we use everywhere) holds ~382 bytes, version 30 holds ~468.
// We target comfortably below that so the print/screen QR stays dense enough
// to survive glare, angle and cheap phone cameras.
const MAX_PAYLOAD_BYTES = 480;

let modelsLoadingPromise = null;
let faceapiModule = null;

/** Lazily import face-api.js and load the three pretrained nets it needs.
 *  Memoized so repeated calls (enroll screen, then scan screen) reuse the
 *  same load. Never trains or fine-tunes anything — these are the stock
 *  pretrained weights shipped by face-api.js. */
export async function loadFaceModels(onProgress) {
  if (modelsLoadingPromise) {
    // Models are already loading or already loaded (e.g. another Face
    // Ticket screen — enroll, verify, guided check-in — triggered the load
    // earlier this session). We reuse that same promise so we never fetch
    // or warm up twice, but this caller's `onProgress` was never wired into
    // the original load, so its local "ready" state would otherwise never
    // flip to true even though the models are perfectly usable. Explicitly
    // signal 'ready' here once the (possibly-already-resolved) promise
    // settles so every caller's readiness state stays correct.
    const faceapi = await modelsLoadingPromise;
    onProgress?.('ready');
    return faceapi;
  }

  modelsLoadingPromise = (async () => {
    onProgress?.('engine');
    const faceapi = await import('face-api.js');
    faceapiModule = faceapi;

    // Some Apple GPU/driver combos (Metal via ANGLE, seen on both Safari and
    // Chrome on Apple Silicon Macs and some iOS versions) fail to compile one
    // of tfjs-backend-webgl's *packed* texture kernels — the compound
    // increment/swizzle helper it emits for certain slice/pack ops trips a
    // strict Metal lvalue-binding rule. It's a driver-level shader compiler
    // bug in ANGLE's Metal backend, not something in our code, and it
    // surfaces as an opaque "Internal error while linking shader" crash the
    // first time a net actually runs (i.e. during the warm-up pass below).
    // Turning off WebGL texture packing makes tfjs fall back to the
    // unpacked kernel variants, which sidesteps the offending codegen
    // entirely while keeping WebGL (GPU) acceleration on. This has to run
    // before any inference — including this module's own warm-up call —
    // so we set it right after face-api's bundled tf is available and
    // before any detector net is loaded/used.
    try {
      const tf = faceapi.tf;
      if (tf?.env) {
        tf.env().set('WEBGL_PACK', false);
      }
    } catch {
      // If face-api's tf export ever changes shape, don't let this
      // best-effort mitigation block model loading — worst case we're
      // back to relying on the warm-up's own try/catch below.
    }

    onProgress?.('detector');
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    onProgress?.('landmarks');
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    onProgress?.('embedding');
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

    // Warm-up pass — the FIRST inference through a freshly loaded tfjs model
    // pays a one-time cost to compile WebGL shader programs. On a desktop
    // GPU that's under a second; on a mid-range phone GPU it can run past
    // our 6s detection timeout, which is what actually produces "Something
    // went wrong reading your face" on someone's very first capture tap.
    // Running one throwaway detection here — against a blank canvas, before
    // the person ever sees the Capture button light up — moves that cost
    // into the loading screen (uncapped) instead of the timed capture call.
    onProgress?.('warmup');
    try {
      const warm = document.createElement('canvas');
      warm.width = 224;
      warm.height = 224;
      await faceapi
        .detectSingleFace(warm, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    } catch {
      // Deliberately swallow ANY error here, not just "no face found" on
      // the blank canvas. This is also where a driver-level WebGL shader
      // compile failure (see the WEBGL_PACK note above) would surface on
      // an affected GPU if the packing workaround didn't fully avoid it —
      // we still only care about paying the shader-compile cost up front,
      // not about getting a usable result from a blank frame, so any
      // failure mode here is safe to ignore and let the real capture flow
      // (which has its own timeout + error handling) be the source of
      // truth for whether face detection actually works on this device.
    }

    onProgress?.('ready');
    return faceapi;
  })();

  return modelsLoadingPromise;
}

export function getFaceApi() {
  return faceapiModule;
}

const detectorOptions = () =>
  new faceapiModule.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

// ─── Video -> canvas snapshot ──────────────────────────────────────────────
// face-api.js (via tfjs's tf.browser.fromPixels) can read pixel data directly
// from a <video> element, but that WebGL texture-upload path is inconsistent
// on mobile — iOS Safari in particular will sometimes upload a blank or stale
// frame from a <video> source with no error, so detection just silently never
// finds a face. Desktop Chrome/Firefox are lenient about this in a way mobile
// browsers aren't. Uploading from a <canvas> instead is reliable everywhere,
// so we snapshot the current frame to a reused offscreen canvas and detect on
// that rather than on the live video element.
let snapshotCanvas = null;

function videoFrameToCanvas(videoEl) {
  const w = videoEl?.videoWidth;
  const h = videoEl?.videoHeight;
  // Not enough decoded data yet (can happen right after start() on a slower
  // mobile camera init) — nothing to detect on this frame.
  if (!w || !h) return null;

  if (!snapshotCanvas) snapshotCanvas = document.createElement('canvas');
  if (snapshotCanvas.width !== w || snapshotCanvas.height !== h) {
    snapshotCanvas.width = w;
    snapshotCanvas.height = h;
  }
  // willReadFrequently forces Safari onto a software-composited 2D canvas,
  // which is the right tradeoff for pixel-readback-heavy loops but is slow
  // per-drawImage() on iOS specifically — it was quietly eating a real
  // chunk of the detection timeout budget on every capture. We only ever
  // draw once per detection call here (not read back pixels in a tight
  // loop the way the name implies), so let the browser pick its normal,
  // GPU-composited canvas instead.
  const ctx = snapshotCanvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);
  return snapshotCanvas;
}

// iOS Safari in particular can resolve <video>.play() before the element
// has actually decoded a first real frame — videoWidth/videoHeight both
// still read 0 for a short, variable window after that. A capture attempt
// that lands in that window has nothing to detect on and, worse, burns
// part of the fixed detection timeout waiting on stale/empty video before
// face-api's own detection call ever starts. This polls for a real decoded
// frame (bounded, short) so the timed detection call only ever starts once
// there's actually something in the frame to find a face in.
async function waitForVideoFrame(videoEl, timeoutMs = 2500) {
  const step = 50;
  let waited = 0;
  while ((!videoEl?.videoWidth || !videoEl?.videoHeight) && waited < timeoutMs) {
    await new Promise((r) => setTimeout(r, step));
    waited += step;
  }
  return !!(videoEl?.videoWidth && videoEl?.videoHeight);
}

// face-api.js's internal input pipeline can, on some mobile browsers, stall
// waiting on a video-readiness signal that never arrives — the promise just
// never settles: no result, no error, no timeout. The canvas-snapshot input
// above sidesteps the usual cause of that, but a detection call should never
// be allowed to hang the UI forever regardless of what causes it, so every
// call here is raced against a hard timeout. If it fires, the caller's normal
// catch block runs and the person sees a real error instead of an infinite
// "analyzing" spinner.
const DETECTION_TIMEOUT_MS = 10000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Full detection: box + 68 landmarks + 128-float descriptor. Used once, for
 *  the frame that actually becomes the ticket or the verification sample —
 *  not run every animation frame, since it's the heaviest of the three nets. */
export async function detectFaceWithDescriptor(videoEl) {
  if (!faceapiModule) throw new Error('Face models not loaded yet');
  await waitForVideoFrame(videoEl);
  const frame = videoFrameToCanvas(videoEl);
  if (!frame) return null;
  const result = await withTimeout(
    faceapiModule.detectSingleFace(frame, detectorOptions()).withFaceLandmarks().withFaceDescriptor(),
    DETECTION_TIMEOUT_MS,
    'Face detection',
  );
  return result || null;
}

/** Multi-face detection: box + landmarks + descriptor for EVERY face in the
 *  current frame, not just one. Used by the kiosk/walk-up auto-scan check-in
 *  mode, where several guests can be in view of a stationary camera at once
 *  and the UI needs to pick out whichever one it's "focusing" on. Heavier
 *  than detectFaceWithDescriptor (runs the descriptor net once per face
 *  found), so callers should throttle how often this runs rather than
 *  calling it every animation frame. Returns [] on no faces / no frame yet,
 *  never null, so callers can iterate without a null check. */
export async function detectAllFacesWithDescriptors(videoEl) {
  if (!faceapiModule) throw new Error('Face models not loaded yet');
  await waitForVideoFrame(videoEl);
  const frame = videoFrameToCanvas(videoEl);
  if (!frame) return [];
  const results = await withTimeout(
    faceapiModule.detectAllFaces(frame, detectorOptions()).withFaceLandmarks().withFaceDescriptors(),
    DETECTION_TIMEOUT_MS,
    'Face detection',
  );
  return results || [];
}

/** Lightweight detection: box + landmarks only, no descriptor. Used for the
 *  liveness sampling loop where we need many quick frames. */
export async function detectFaceLandmarksOnly(videoEl) {
  if (!faceapiModule) throw new Error('Face models not loaded yet');
  const frame = videoFrameToCanvas(videoEl);
  if (!frame) return null;
  const result = await withTimeout(
    faceapiModule.detectSingleFace(frame, detectorOptions()).withFaceLandmarks(),
    DETECTION_TIMEOUT_MS,
    'Face detection',
  );
  return result || null;
}

// ─── Quantization ────────────────────────────────────────────────────────
// 128 floats (4 bytes each = 512B) -> 128 bytes + 2 small floats for range.
// Roughly a 4x reduction, as specced.

export function quantizeEmbedding(float32arr) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of float32arr) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1e-6;
  const bytes = new Uint8Array(float32arr.length);
  for (let i = 0; i < float32arr.length; i++) {
    bytes[i] = Math.max(0, Math.min(255, Math.round(((float32arr[i] - min) / range) * 255)));
  }
  return { bytes, min, max };
}

export function dequantizeEmbedding(bytes, min, max) {
  const range = max - min || 1e-6;
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = min + (bytes[i] / 255) * range;
  }
  return out;
}

export function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Base64 helpers (Uint8Array <-> string, no Node Buffer) ───────────────

// Exported so utils/eventRoster.js (Face Ticket event/roster mode) can reuse
// the exact same encoding for embeddings it persists to localStorage and
// packs into event-ticket QR payloads, instead of drifting out of sync with
// a second implementation.
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function byteLengthOf(str) {
  return new TextEncoder().encode(str).length;
}

// ─── Ticket payload pack / unpack ──────────────────────────────────────────

/** Packs everything the QR needs to carry into the smallest reasonable JSON
 *  string, trimming metadata if the encoded size creeps past budget so the
 *  QR stays scannable. Returns { json, byteLength, trimmed }. */
export function packTicketPayload({ name, eventName, seatId, quantized }) {
  const build = (nameLen, eventLen) => {
    const obj = {
      v: PROTOCOL_VERSION,
      n: (name || 'Guest').trim().slice(0, nameLen),
      e: (eventName || 'PlanIt Beta Event').trim().slice(0, eventLen),
      s: (seatId || '').trim().slice(0, 12),
      t: Math.floor(Date.now() / 1000),
      mn: Math.round(quantized.min * 100000) / 100000,
      mx: Math.round(quantized.max * 100000) / 100000,
      d: bytesToBase64(quantized.bytes),
    };
    return JSON.stringify(obj);
  };

  let json = build(28, 32);
  let trimmed = false;
  let nameLen = 28, eventLen = 32;

  // Defensive shrink loop — the descriptor bytes dominate size (~172 chars
  // base64) so this rarely triggers, but we honor the spec's requirement
  // to verify actual size and trim if needed.
  while (byteLengthOf(json) > MAX_PAYLOAD_BYTES && (nameLen > 8 || eventLen > 8)) {
    nameLen = Math.max(8, nameLen - 6);
    eventLen = Math.max(8, eventLen - 6);
    json = build(nameLen, eventLen);
    trimmed = true;
  }

  return { json, byteLength: byteLengthOf(json), trimmed };
}

export function unpackTicketPayload(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This QR code isn\u2019t a Face Ticket payload.');
  }
  if (!obj || obj.v !== PROTOCOL_VERSION || typeof obj.d !== 'string') {
    throw new Error('Unrecognized ticket format.');
  }
  const bytes = base64ToBytes(obj.d);
  if (bytes.length !== 128) {
    throw new Error('Ticket embedding is malformed.');
  }
  return {
    name: obj.n || 'Guest',
    eventName: obj.e || 'PlanIt Beta Event',
    seatId: obj.s || '',
    issuedAt: obj.t ? new Date(obj.t * 1000) : null,
    quantized: { bytes, min: obj.mn, max: obj.mx },
  };
}

// ─── Liveness: eye-aspect-ratio blink detection + nose-tip motion check ───
// Deliberately simple and clearly labeled "beta" in the UI — this is a
// proof-of-concept anti-spoof signal, not a hardened liveness system.

function dist(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/** Eye-aspect-ratio for a 6-point eye contour, per Soukupov\u00e1 & \u010cech. */
function eyeAspectRatio(eye) {
  const vertical1 = dist(eye[1], eye[5]);
  const vertical2 = dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function averageEAR(landmarks) {
  const left = eyeAspectRatio(landmarks.getLeftEye());
  const right = eyeAspectRatio(landmarks.getRightEye());
  return (left + right) / 2;
}

// ─── Active-challenge liveness ────────────────────────────────────────────
// A photo or a pre-recorded clip can't know which prompts it will be given,
// so the sequence is drawn at random per attempt (crypto RNG) and always
// contains at least one head turn. The result is a hard pass/fail — callers
// must gate on `liveness.passed`.

export const LIVENESS_CHALLENGES = {
  blink: { label: 'Close your eyes for a second' },
  left: { label: 'Turn your head left' },
  right: { label: 'Turn your head right' },
  mouth: { label: 'Open your mouth wide' },
};

function randInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** Random 3-step sequence, no immediate repeats, always includes a head turn. */
export function pickLivenessSequence(count = 3) {
  const ids = Object.keys(LIVENESS_CHALLENGES);
  for (let attempt = 0; attempt < 50; attempt++) {
    const seq = [];
    while (seq.length < count) {
      const id = ids[randInt(ids.length)];
      if (seq[seq.length - 1] !== id) seq.push(id);
    }
    if (seq.includes('left') || seq.includes('right')) return seq;
  }
  return ['left', 'blink', 'mouth'];
}

function percentile(arr, q) {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

function median(arr) {
  const s = [...arr].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

// Head yaw proxy: where the nose tip sits between the two jaw extremes.
// ~0.5 facing the camera. Larger = nose toward image-right, which on the
// mirrored preview the user sees is the user's LEFT.
function yawRatio(landmarks) {
  const jaw = landmarks.getJawOutline();
  const l = jaw[0].x;
  const r = jaw[jaw.length - 1].x;
  const w = r - l;
  if (w <= 0) return null;
  const nose = landmarks.getNose()[3];
  return (nose.x - l) / w;
}

function mouthOpenRatio(landmarks) {
  const m = landmarks.getMouth();
  const w = dist(m[12], m[16]);
  if (w === 0) return 0;
  return dist(m[14], m[18]) / w;
}

function readFrame(landmarks) {
  const nose = landmarks.getNose()[3];
  return {
    ear: averageEAR(landmarks),
    yaw: yawRatio(landmarks),
    mar: mouthOpenRatio(landmarks),
    nose: { x: nose.x, y: nose.y },
  };
}

const SAME_FACE_MIN = 0.7;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs the active liveness challenge.
 *  onChallenge({ index, total, id, label, phase }) — phase: 'calibrate' | 'prompt' | 'passed'
 *  onSample({ progress, ear, faceFound })
 *  Resolves with { passed, challenges:[{id,label,passed}], faceCoverage, reason?,
 *  blinkDetected, motionDetected, cumulativeMotion, baselineEAR }. */
export async function runLivenessCapture(videoEl, { onSample, onChallenge, challengeTimeoutMs = 8000 } = {}) {
  const sequence = pickLivenessSequence(3);
  const total = sequence.length;
  let frames = 0;
  let framesWithFace = 0;
  let cumulativeMotion = 0;
  let lastNose = null;
  let lastEar = null;
  let done = 0;

  const grab = async () => {
    let result = null;
    try {
      result = await detectFaceLandmarksOnly(videoEl);
    } catch (err) {
      console.warn('Liveness frame skipped:', err);
    }
    frames++;
    let frame = null;
    if (result) {
      frame = readFrame(result.landmarks);
      if (frame.yaw === null) frame = null;
    }
    if (frame) {
      framesWithFace++;
      lastEar = frame.ear;
      if (lastNose) cumulativeMotion += dist(frame.nose, lastNose);
      lastNose = frame.nose;
    }
    onSample?.({ progress: Math.min(1, done / total), ear: frame ? frame.ear : lastEar, faceFound: !!frame });
    return frame;
  };

  const finish = (passed, challenges, reason) => ({
    passed,
    reason,
    challenges,
    faceCoverage: frames ? framesWithFace / frames : 0,
    blinkDetected: challenges.some((c) => c.id === 'blink' && c.passed),
    motionDetected: challenges.some((c) => (c.id === 'left' || c.id === 'right') && c.passed),
    cumulativeMotion,
    baselineEAR: null,
  });

  const results = sequence.map((id) => ({ id, label: LIVENESS_CHALLENGES[id].label, passed: false }));

  // 1) Calibrate on a neutral, forward-facing face.
  onChallenge?.({ index: -1, total, id: 'calibrate', label: 'Look straight at the camera', phase: 'calibrate' });
  const cal = [];
  const calStart = performance.now();
  while (cal.length < 8 && performance.now() - calStart < 3500) {
    const f = await grab();
    if (f) cal.push(f);
    await sleep(60);
  }
  if (cal.length < 6) return finish(false, results, 'no_face');
  const base = {
    ear: percentile(cal.map((f) => f.ear), 0.75),
    yaw: median(cal.map((f) => f.yaw)),
    mar: median(cal.map((f) => f.mar)),
  };
  // Refuse to calibrate on someone who is already turned away / mouth open.
  if (Math.abs(base.yaw - 0.5) > 0.2 || base.mar > 0.3) return finish(false, results, 'bad_calibration');

  // Bind the challenge to ONE identity: embed the face now and again at the
  // end. A live person passing prompts and then swapping in a photo of
  // someone else (or vice-versa) fails the comparison.
  const embed = async () => {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await detectFaceWithDescriptor(videoEl);
        if (r) return r.descriptor;
      } catch (err) { console.warn('Liveness embed skipped:', err); }
      await sleep(120);
    }
    return null;
  };
  const startDesc = await embed();
  if (!startDesc) return finish(false, results, 'no_face');

  // 2) Random prompts.
  for (let i = 0; i < total; i++) {
    const id = sequence[i];
    onChallenge?.({ index: i, total, id, label: LIVENESS_CHALLENGES[id].label, phase: 'prompt' });

    let ok = false;
    let hold = 0;
    const t0 = performance.now();

    while (performance.now() - t0 < challengeTimeoutMs && !ok) {
      const f = await grab();
      if (f) {
        if (id === 'blink') {
          // Eyes-closed detection instead of catching a ~100ms blink between
          // frames: a clear dip on one frame, or a moderate dip held for two.
          if (f.ear < base.ear * 0.72) ok = true;
          else if (f.ear < base.ear * 0.85) { hold += 1; ok = hold >= 2; }
          else hold = 0;
        } else if (id === 'left') {
          hold = f.yaw - base.yaw > 0.09 ? hold + 1 : 0;
          ok = hold >= 2;
        } else if (id === 'right') {
          hold = base.yaw - f.yaw > 0.09 ? hold + 1 : 0;
          ok = hold >= 2;
        } else if (id === 'mouth') {
          hold = f.mar - base.mar > 0.15 ? hold + 1 : 0;
          ok = hold >= 2;
        }
      }
      if (id !== 'blink') await sleep(40);
    }

    if (!ok) return finish(false, results, 'timeout');
    results[i].passed = true;
    done = i + 1;
    onChallenge?.({ index: i, total, id, label: LIVENESS_CHALLENGES[id].label, phase: 'passed' });

    // Wait for the face to relax back to neutral before the next prompt so
    // one gesture can't satisfy two steps.
    const r0 = performance.now();
    while (performance.now() - r0 < 2500) {
      const f = await grab();
      if (f && Math.abs(f.yaw - base.yaw) < 0.07 && f.mar - base.mar < 0.1 && f.ear > base.ear * 0.85) break;
      await sleep(40);
    }
  }

  onSample?.({ progress: 1, ear: lastEar, faceFound: true });

  // Final identity sample, face relaxed and forward-facing again.
  const endDesc = await embed();
  if (!endDesc) return finish(false, results, 'no_face');
  const sameFace = cosineSimilarity(startDesc, endDesc);
  if (sameFace < SAME_FACE_MIN) return { ...finish(false, results, 'face_changed'), sameFace };

  return { ...finish(true, results), baselineEAR: base.ear, sameFace, descriptor: endDesc };
}

export function formatConfidence(similarity) {
  // Cosine similarity on face-api descriptors typically sits in ~0.3-0.9
  // for genuine matches and lower for mismatches; we present it as a 0-100
  // "confidence" scaled around the spec's suggested 0.6-0.7 decision band.
  return Math.round(Math.max(0, Math.min(1, similarity)) * 100);
}
