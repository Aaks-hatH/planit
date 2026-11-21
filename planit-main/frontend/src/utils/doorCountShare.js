// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — anonymous result text and check-in reconciliation reading
//
// The shareable result is numbers and settings only: no video, no image, no
// name, no event, no user-agent string. It is built here, shown to the tester
// exactly as it will be copied, and never sent anywhere by this page.
// ═══════════════════════════════════════════════════════════════════════════

import { MODELS } from './doorCountModel';

/** Coarse device class such as "phone-mid". No model names, no user agent. */
export function deviceClass() {
  try {
    const touch = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
    const short = Math.min(window.screen.width, window.screen.height);
    const form = touch ? (short < 600 ? 'phone' : 'tablet') : 'desktop';
    const cores = navigator.hardwareConcurrency || 0;
    const tier = cores >= 8 ? 'high' : cores >= 5 ? 'mid' : cores > 0 ? 'low' : 'unknown';
    return `${form}-${tier}`;
  } catch {
    return 'unknown';
  }
}

const round = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

/** perf = { inferAvg, fps, delegate } from the live page (any field may be null).
 *  lab = { row, clip, taps } for the preset that matches the current settings,
 *  or null when that has not been measured. */
export function buildShare(settings, perf, lab) {
  return {
    tool: 'PlanIt Labs Door Count',
    version: 1,
    model: MODELS[settings.model].full,
    detectEveryNFrames: settings.n,
    gate: settings.gateMode === 'two' ? 'two-line gate' : 'one line',
    delegate: perf?.delegate ?? null,
    avgInferenceMs: round(perf?.inferAvg ?? lab?.row?.inferAvg),
    avgFps: round(perf?.fps, 0),
    accuracy: lab
      ? {
        precision: round(lab.row.precision, 2),
        recall: round(lab.row.recall, 2),
        netCountError: lab.row.netError,
        labeledCrossings: lab.taps,
        clipSeconds: round(lab.clip.seconds, 0),
      }
      : null,
    deviceClass: deviceClass(),
  };
}

export const shareText = (payload) => JSON.stringify(payload, null, 2);

/** Plain-language reading of walked-in minus scanned-in. */
export function readReconciliation(walked, scanned) {
  if (walked === 0 && scanned === 0) return 'Nothing to compare yet.';
  const diff = walked - scanned;
  const tol = Math.max(2, Math.round(0.1 * Math.max(walked, scanned)));
  if (diff > tol) {
    return `${diff} more ${diff === 1 ? 'person' : 'people'} entered than scanned: possible tailgating or walk-ins. Staff, vendors and anyone who re-enters are also counted as entering.`;
  }
  if (diff < -tol) {
    return `${-diff} fewer ${-diff === 1 ? 'person' : 'people'} counted than scanned: the camera may be undercounting (crowds and overlap are the usual cause), or some guests were scanned somewhere else.`;
  }
  return `Within ${tol} of each other: ${walked} entered, ${scanned} scanned.`;
}
