import { Component } from 'react';
import { AlertTriangle, LifeBuoy, RefreshCw, Home, Copy, Check } from 'lucide-react';
import { explainError, supportMailto, SUPPORT_EMAIL, HELP_PATH } from '../utils/friendlyError';

/**
 * App-wide safety net. If any component throws while rendering, the person gets
 * what happened / why / how to fix it — and a support link — instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, info: null, copied: false }; }

  static getDerivedStateFromError(error) {
    return { error, info: explainError(error) };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  copy = async () => {
    try {
      await navigator.clipboard.writeText(this.state.info.details);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch { /* clipboard blocked */ }
  };

  render() {
    const { error, info, copied } = this.state;
    if (!error) return this.props.children;

    // Render crashes are our bug, not the person's. Say so unless it is a stale-deploy chunk error.
    const isChunk = info.kind === 'chunk';
    const view = isChunk ? info : {
      ...info,
      headline: 'This page hit a problem',
      why: "Something in PlanIt crashed while showing this page, and we don't know exactly why. It isn't something you did wrong, and your saved data is safe.",
      fix: 'Reload the page. If it keeps happening, contact support and quote the reference below.',
      known: false,
    };
    const mailto = supportMailto({ headline: view.headline, ref: view.ref, details: view.details });
    const btn = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold';

    return (
      <div role="alert" style={{ minHeight: '100vh', background: '#0a0a12', color: '#f7f6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <AlertTriangle size={44} style={{ color: '#f59e0b', margin: '0 auto 14px' }} aria-hidden="true" />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>{view.headline}</h1>
          <p style={{ color: 'rgba(247,246,242,0.75)', fontSize: 14, lineHeight: 1.55, margin: '0 0 8px' }}><b style={{ color: '#f7f6f2' }}>Why: </b>{view.why}</p>
          <p style={{ color: 'rgba(247,246,242,0.75)', fontSize: 14, lineHeight: 1.55, margin: '0 0 20px' }}><b style={{ color: '#f7f6f2' }}>{view.known ? 'How to fix: ' : 'What to do: '}</b>{view.fix}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className={btn} style={{ background: '#f7f6f2', color: '#0f0f14' }} onClick={() => window.location.reload()}>
              <RefreshCw size={15} /> Reload the page
            </button>
            <a href={mailto} className={btn} style={{ background: 'rgba(255,255,255,0.08)', color: '#f7f6f2', border: '1px solid rgba(255,255,255,0.14)' }}>
              <LifeBuoy size={15} /> Contact support
            </a>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/" className={btn} style={{ flex: 1, background: 'transparent', color: 'rgba(247,246,242,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}><Home size={15} /> Home</a>
              <a href={HELP_PATH} className={btn} style={{ flex: 1, background: 'transparent', color: 'rgba(247,246,242,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}>Help center</a>
              <button type="button" onClick={this.copy} className={btn} style={{ flex: 1, background: 'transparent', color: 'rgba(247,246,242,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Details</>}
              </button>
            </div>
          </div>

          <p style={{ marginTop: 16, fontSize: 12, color: 'rgba(247,246,242,0.45)' }}>
            Reference <b style={{ fontFamily: 'ui-monospace, monospace' }}>{view.ref}</b> · {SUPPORT_EMAIL}
          </p>
        </div>
      </div>
    );
  }
}
