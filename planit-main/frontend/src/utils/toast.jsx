/**
 * Drop-in replacement for `import toast from './toast'`.
 *
 * Everything (success, loading, custom, dismiss…) behaves exactly as before.
 * Only `toast.error` changes: instead of a one-line "Failed", the person sees
 *   • what happened      • why it happened      • how to fix it
 * and, when we can't tell what went wrong, an honest "we don't know" with a
 * one-tap way to contact support (pre-filled with a reference code).
 *
 * Call it any of these ways — all work:
 *   toast.error('Could not save the task')            // picks up the failed API call automatically
 *   toast.error('Could not save the task', { error })  // or pass the error explicitly
 *   toast.error(err)                                   // an Error / axios error on its own
 */
import { useState } from 'react';
import baseToast from 'react-hot-toast';
import { AlertTriangle, X, LifeBuoy, Copy, Check, RefreshCw } from 'lucide-react';
import {
  explainError, takeRecentApiError, supportMailto,
  BLAND_TITLE, LOOKS_LIKE_FAILURE, HELP_PATH, STATUS_PATH, SUPPORT_EMAIL,
} from './friendlyError';

const linkBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
  borderRadius: 8, fontSize: 12, fontWeight: 600, lineHeight: 1.2, cursor: 'pointer',
  textDecoration: 'none', border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#f7f6f2', fontFamily: 'inherit',
};
const primaryBtn = { ...linkBtn, background: '#f7f6f2', color: '#0f0f14', border: '1px solid #f7f6f2' };

export function ErrorToastCard({ t, info, headline, onClose }) {
  const [copied, setCopied] = useState(false);
  const mailto = supportMailto({ headline, ref: info.ref, details: info.details });
  const supportPrimary = !info.known;               // unknown failure → support is the main action
  const showStatus = ['network', 'unavailable', 'server', 'timeout'].includes(info.kind);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the email link still carries the details */ }
  };

  return (
    <div
      role="alert"
      style={{
        width: 'min(26rem, calc(100vw - 2rem))', boxSizing: 'border-box',
        background: '#0f0f14', color: '#f7f6f2', borderRadius: 12,
        border: '1px solid rgba(239,68,68,0.35)', padding: '12px 14px',
        boxShadow: '0 12px 28px -6px rgba(15,15,20,0.45)',
        fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '0.8125rem', lineHeight: 1.45,
        opacity: t.visible ? 1 : 0, transform: t.visible ? 'none' : 'translateY(-6px)',
        transition: 'opacity .2s, transform .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{headline}</div>
          {info.why && <p style={{ margin: '4px 0 0', color: 'rgba(247,246,242,0.78)' }}><b style={{ color: '#f7f6f2' }}>Why: </b>{info.why}</p>}
          {info.fix && <p style={{ margin: '4px 0 0', color: 'rgba(247,246,242,0.78)' }}><b style={{ color: '#f7f6f2' }}>{info.known ? 'How to fix: ' : 'What to do: '}</b>{info.fix}</p>}
        </div>
        <button
          type="button" onClick={onClose} aria-label="Dismiss error"
          style={{ background: 'none', border: 0, color: 'rgba(247,246,242,0.55)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {info.kind === 'chunk' && (
          <button type="button" style={primaryBtn} onClick={() => window.location.reload()}>
            <RefreshCw size={12} /> Refresh page
          </button>
        )}
        <a href={mailto} style={supportPrimary ? primaryBtn : linkBtn}>
          <LifeBuoy size={12} /> Contact support
        </a>
        {showStatus && <a href={STATUS_PATH} style={linkBtn}>Status page</a>}
        <a href={HELP_PATH} style={linkBtn}>Help center</a>
        <button type="button" onClick={copy} style={linkBtn} aria-label="Copy technical details">
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy details</>}
        </button>
      </div>

      {!info.known && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(247,246,242,0.5)' }}>
          Quote reference <b style={{ fontFamily: 'ui-monospace, monospace' }}>{info.ref}</b> · {SUPPORT_EMAIL}
        </p>
      )}
    </div>
  );
}

function showErrorCard(info, headline, opts = {}) {
  // Same problem twice in a row replaces itself instead of stacking.
  const id = opts.id || `err:${info.kind}:${info.status}:${headline}`;
  return baseToast.custom(
    (t) => <ErrorToastCard t={t} info={info} headline={headline} onClose={() => baseToast.dismiss(t.id)} />,
    { id, duration: info.known ? 10000 : 15000, ...opts },
  );
}

function errorToast(input, opts = {}) {
  const isThrown = input instanceof Error || (input && typeof input === 'object' && (input.isAxiosError || input.response || input.name));
  const isText = typeof input === 'string' || typeof input === 'number';

  // JSX / other react-hot-toast message shapes: not ours to interpret.
  if (!isThrown && !isText && input != null) return baseToast.error(input, opts);

  const { error: passedError, title: passedTitle, ...toastOpts } = opts;
  const title = isThrown ? (passedTitle || '') : String(input ?? '');
  const source = passedError || (isThrown ? input : takeRecentApiError());

  // A plain validation hint ("Select at least one recipient") is already instructive — leave it be.
  if (!source && !isThrown && !LOOKS_LIKE_FAILURE.test(title)) return baseToast.error(title, toastOpts);

  const info = explainError(source || title, {});
  if (!source) {
    // We have only the app's own wording and nothing underneath it: say we can't tell why.
    info.known = false; info.kind = 'unknown'; info.why = "We don't know exactly what caused this.";
    info.fix = 'Try again, or refresh the page. If it keeps happening, contact support and quote the reference below.';
  }
  if (info.kind === 'canceled') return undefined;

  // Keep the app's own wording as the headline when it describes the task ("Failed to save seating map");
  // use ours when the app's was empty, bland, or just echoed the server's generic string.
  const echoedServer = info.serverMessage && title.trim() === info.serverMessage.trim();
  const headline = !title || BLAND_TITLE.test(title.trim()) || echoedServer ? info.headline : title.replace(/[.!]+$/, '');
  // When we keep their headline and the explainer's headline says something extra, fold it into "why".
  if (headline !== info.headline && info.headline && !info.why?.toLowerCase().includes(info.headline.toLowerCase())) {
    info.why = info.known ? `${info.headline}. ${info.why}` : info.why;
  }
  info.details = `${info.details}\nWhat failed: ${headline}`;
  return showErrorCard(info, headline, toastOpts);
}

/** Show an error from anywhere (event handlers, window error hooks) with full explanation. */
export function showError(err, title, opts) {
  return errorToast(err, { ...opts, title });
}

const toast = Object.assign((...args) => baseToast(...args), baseToast, { error: errorToast });

export default toast;
export { toast };
