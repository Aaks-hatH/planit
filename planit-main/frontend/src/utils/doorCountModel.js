// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — person detector (MediaPipe Object Detector, on-device)
//
// What needs the network, and when:
//   - The MediaPipe library and its WASM come from the jsDelivr CDN, pinned to
//     an exact version. They are fetched on every cold load; this page does
//     not store them, so they are the part that still needs a connection.
//   - The .tflite model is fetched once and kept in Cache Storage. Later loads
//     read it from there and hand it to MediaPipe as a buffer, so the model
//     itself no longer needs the network.
// No video frame is ever sent anywhere: frames only go to the local detector.
// ═══════════════════════════════════════════════════════════════════════════

// Pinned. 0.10.21 was published 2025-02-06 and contains vision_bundle.mjs and wasm/.
export const VISION_VERSION = '0.10.21';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;

// Model sources are tried in order. The first is the host Google's current
// documentation links to; the second is the older storage path from the
// prototype. Neither could be fetched while building this page (see notes).
const HF = 'https://huggingface.co/litert-community/MediaPipe-ObjectDetector-EfficientDet-Lite';
const GCS = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite';
export const MODELS = {
  lite: {
    id: 'lite', label: 'Lite0', full: 'EfficientDet-Lite0', size: 320,
    urls: [`${HF}0/resolve/main/efficientdet_lite0_float16.tflite`, `${GCS}0/float16/1/efficientdet_lite0.tflite`],
  },
  large: {
    id: 'large', label: 'Lite2', full: 'EfficientDet-Lite2', size: 448,
    urls: [`${HF}2/resolve/main/efficientdet_lite2_float16.tflite`, `${GCS}2/float16/1/efficientdet_lite2.tflite`],
  },
};

const CACHE_NAME = 'planit-door-count-models-v1';
const MIN_MODEL_BYTES = 1_000_000; // rejects an HTML error page saved by mistake

/** Error with a stable code so the UI can show a specific message. */
export class DoorCountError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export const LOAD_MESSAGES = {
  LIB: 'Could not load the MediaPipe library from the CDN (cdn.jsdelivr.net). It needs the network on every cold load. Check your connection and retry.',
  MODEL_FETCH: 'Could not download the detection model. Check your connection and retry. Once downloaded it is kept on this device.',
  MODEL_INIT: 'The detection model downloaded but could not start on this device. Try the other model or a different browser.',
};

// ─── Library ───────────────────────────────────────────────────────────────
let visionPromise = null;

function loadVision() {
  visionPromise ??= (async () => {
    // The URL is a runtime value on purpose: the bundler must not try to resolve it.
    const vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    return { vision, fileset };
  })().catch(() => {
    visionPromise = null; // allow a retry after a network failure
    throw new DoorCountError('LIB', LOAD_MESSAGES.LIB);
  });
  return visionPromise;
}

// ─── Model file ────────────────────────────────────────────────────────────
/** Model bytes from Cache Storage if present, else from the network (then cached). */
async function fetchModelBuffer(model) {
  let cache = null;
  try { cache = await caches.open(CACHE_NAME); } catch { /* no Cache Storage here: fetch every time */ }

  for (const url of model.urls) {
    try {
      const hit = cache && (await cache.match(url));
      if (hit) {
        const buffer = await hit.arrayBuffer();
        if (buffer.byteLength >= MIN_MODEL_BYTES) return { buffer, source: 'cache' };
      }
    } catch { /* fall through to the network */ }
  }

  for (const url of model.urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.clone().arrayBuffer();
      if (buffer.byteLength < MIN_MODEL_BYTES) throw new Error('unexpectedly small file');
      try { await cache?.put(url, res); } catch { /* quota or private mode: still usable this time */ }
      return { buffer, source: 'network' };
    } catch { /* try the next source */ }
  }
  throw new DoorCountError('MODEL_FETCH', LOAD_MESSAGES.MODEL_FETCH);
}

// ─── Detector ──────────────────────────────────────────────────────────────
export class DoorDetector {
  constructor() {
    this.work = document.createElement('canvas');
    this.ctx = this.work.getContext('2d');
    this.det = null;
    this.info = null;     // { model, delegate, source }
    this.lastTs = 0;
  }

  nextTs() { // MediaPipe's video mode needs strictly increasing timestamps
    this.lastTs = Math.max(performance.now(), this.lastTs + 1);
    return this.lastTs;
  }

  /** Loads a model: GPU first, CPU if the GPU path fails. Throws DoorCountError. */
  async load(modelId, conf, onStatus) {
    this.close();
    const model = MODELS[modelId];
    onStatus?.('Loading the detection library');
    const { vision, fileset } = await loadVision();
    onStatus?.('Loading the model');
    const { buffer, source } = await fetchModelBuffer(model);

    const create = (delegate) => vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: new Uint8Array(buffer.slice(0)), delegate },
      runningMode: 'VIDEO',
      scoreThreshold: conf,
      categoryAllowlist: ['person'],
    });

    let delegate = 'GPU';
    try {
      this.det = await create('GPU');
      this.warm(model.size);
    } catch {
      try { this.det?.close(); } catch { /* already gone */ }
      this.det = null;
      delegate = 'CPU';
      try {
        this.det = await create('CPU');
        this.warm(model.size);
      } catch {
        throw new DoorCountError('MODEL_INIT', LOAD_MESSAGES.MODEL_INIT);
      }
    }
    this.info = { model, delegate, source };
    return this.info;
  }

  warm(size) { // first inferences are slow; absorb them before anyone is timed
    this.work.width = this.work.height = size;
    this.ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3; i++) this.det.detectForVideo(this.work, this.nextTs());
  }

  setConf(conf) { this.det?.setOptions({ scoreThreshold: conf }); }

  /** Detect people in the current frame of `video`, optionally inside `roi`.
   *  The crop is drawn at the model's native size with its aspect kept (no
   *  stretching). Returns boxes normalised to the full frame, plus timings. */
  detect(video, roi) {
    const vw = video.videoWidth, vh = video.videoHeight, M = this.info.model.size;
    const r = roi || { x: 0, y: 0, w: 1, h: 1 };
    const cx = r.x * vw, cy = r.y * vh, cw = r.w * vw, ch = r.h * vh;
    const sc = M / Math.max(cw, ch);
    if (this.work.width !== M) this.work.width = this.work.height = M;

    const t0 = performance.now();
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, M, M);
    this.ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw * sc, ch * sc);
    const t1 = performance.now();
    const res = this.det.detectForVideo(this.work, this.nextTs());
    const t2 = performance.now();

    const boxes = res.detections
      .map((d) => {
        const b = d.boundingBox;
        return { x: (cx + b.originX / sc) / vw, y: (cy + b.originY / sc) / vh, w: b.width / sc / vw, h: b.height / sc / vh };
      })
      .filter((b) => b.w > 0 && b.h > 0);
    return { boxes, prepMs: t1 - t0, inferMs: t2 - t1 };
  }

  close() {
    try { this.det?.close(); } catch { /* already closed */ }
    this.det = null;
  }
}
