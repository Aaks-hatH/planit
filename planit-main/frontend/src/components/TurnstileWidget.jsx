import { useEffect, useRef } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAACvGuW0fbNIYbAiK';

export default function TurnstileWidget({ onToken, theme = 'dark', resetKey = 0 }) {
  const turnstileRef = useRef(null);
  const turnstileWidget = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;

    const mount = () => {
      if (!turnstileRef.current || !window.turnstile) return;
      if (turnstileWidget.current !== null) {
        try { window.turnstile.remove(turnstileWidget.current); } catch (_) {}
        turnstileWidget.current = null;
      }
      turnstileWidget.current = window.turnstile.render(turnstileRef.current, {
        sitekey:            TURNSTILE_SITE_KEY,
        theme,
        callback:           (token) => onToken?.(token),
        'expired-callback': ()      => onToken?.(''),
        'error-callback':   ()      => onToken?.(''),
      });
    };

    if (window.turnstile) {
      mount();
      return () => {
        if (turnstileWidget.current !== null) {
          try { window.turnstile.remove(turnstileWidget.current); } catch (_) {}
          turnstileWidget.current = null;
        }
      };
    }

    let pollInterval = null;
    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(pollInterval);
          pollInterval = null;
          mount();
        }
      }, 50);
    };
    startPolling();

    return () => {
      if (pollInterval !== null) clearInterval(pollInterval);
      if (turnstileWidget.current !== null) {
        try { window.turnstile.remove(turnstileWidget.current); } catch (_) {}
        turnstileWidget.current = null;
      }
    };
  }, [onToken, resetKey, theme]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={turnstileRef} />;
}
