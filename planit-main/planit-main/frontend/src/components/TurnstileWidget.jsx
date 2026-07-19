import { useEffect, useRef, useState, useCallback } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAACvGuW0fbNIYbAiK';

// Maximum time to wait for the Turnstile script to load before giving up
const SCRIPT_LOAD_TIMEOUT_MS = 8000;

export default function TurnstileWidget({ onToken, theme = 'dark', resetKey = 0 }) {
  const turnstileRef    = useRef(null);
  const turnstileWidget = useRef(null);
  const pollInterval    = useRef(null);
  const timeoutHandle   = useRef(null);
  const [scriptFailed, setScriptFailed] = useState(false);

  // Stable callback ref — prevents the effect re-running just because
  // the parent re-rendered and passed a new function reference.
  // Without this, every parent re-render tears down and restarts the widget.
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  const cleanup = useCallback(() => {
    if (pollInterval.current !== null) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    if (timeoutHandle.current !== null) {
      clearTimeout(timeoutHandle.current);
      timeoutHandle.current = null;
    }
    if (turnstileWidget.current !== null) {
      try { window.turnstile?.remove(turnstileWidget.current); } catch (_) {}
      turnstileWidget.current = null;
    }
  }, []);

  const mount = useCallback(() => {
    if (!turnstileRef.current || !window.turnstile) return;

    // Remove any existing widget before mounting a fresh one
    if (turnstileWidget.current !== null) {
      try { window.turnstile.remove(turnstileWidget.current); } catch (_) {}
      turnstileWidget.current = null;
    }

    turnstileWidget.current = window.turnstile.render(turnstileRef.current, {
      sitekey:            TURNSTILE_SITE_KEY,
      theme,
      callback:           (token) => onTokenRef.current?.(token),
      'expired-callback': ()      => onTokenRef.current?.(''),
      'error-callback':   ()      => onTokenRef.current?.(''),
    });
  }, [theme]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    setScriptFailed(false);

    // Script already loaded — mount immediately
    if (window.turnstile) {
      mount();
      return cleanup;
    }

    // Script not yet loaded — poll for it with a hard timeout
    timeoutHandle.current = setTimeout(() => {
      // Gave up waiting — clear the poll and show the fallback
      if (pollInterval.current !== null) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      if (!window.turnstile) {
        setScriptFailed(true);
      }
    }, SCRIPT_LOAD_TIMEOUT_MS);

    pollInterval.current = setInterval(() => {
      if (window.turnstile) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
        clearTimeout(timeoutHandle.current);
        timeoutHandle.current = null;
        mount();
      }
    }, 50);

    return cleanup;

  // resetKey is intentional — parent uses it to force a fresh widget.
  // theme is intentional — widget must re-render if theme changes.
  // onToken is intentionally excluded — handled via ref above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, theme, mount, cleanup]);

  if (!TURNSTILE_SITE_KEY) return null;

  // Turnstile script failed to load — give the user a way to continue
  if (scriptFailed) {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.05)',
        color: theme === 'light' ? '#555' : 'rgba(255,255,255,0.5)',
        fontSize: 13,
        textAlign: 'center',
      }}>
        Verification could not load.{' '}
        <button
          onClick={() => {
            setScriptFailed(false);
            // Force a retry by reloading the Turnstile script
            const existing = document.querySelector(
              'script[src*="challenges.cloudflare.com/turnstile"]'
            );
            if (existing) existing.remove();
            const s = document.createElement('script');
            s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            s.async = true;
            s.defer = true;
            document.head.appendChild(s);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            color: 'inherit',
            fontSize: 'inherit',
            padding: 0,
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return <div ref={turnstileRef} />;
}
