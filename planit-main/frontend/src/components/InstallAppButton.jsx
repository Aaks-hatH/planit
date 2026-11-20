import { useState } from 'react';
import { Download } from 'lucide-react';
import InstallGuide from './InstallGuide';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * InstallAppButton
 * An always-available "Install the app" button that opens the step-by-step guide for the device being
 * used. Unlike InstallBanner it ignores the 14-day dismissal, so closing the banner never removes the
 * way to install. It hides only when the app is already running installed (standalone), where it would
 * be pointless.
 *
 * Styling is left to the caller (`className`), because the homepage and the app use different button styles.
 */
export default function InstallAppButton({ className = '', wrapperClassName, hint, children = 'Install the app', appName = 'PlanIt', iconSize = 18, onOpen, ...rest }) {
  const { isInstalled } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  if (isInstalled) return null;
  const button = (
    <button
      type="button"
      className={className}
      onClick={() => { setOpen(true); onOpen?.(); }}
      aria-haspopup="dialog"
      {...rest}
    >
      <Download size={iconSize} aria-hidden="true" />
      {children}
    </button>
  );
  return (
    <>
      {wrapperClassName || hint ? <div className={wrapperClassName}>{button}{hint && <small>{hint}</small>}</div> : button}
      <InstallGuide open={open} onClose={() => setOpen(false)} appName={appName} />
    </>
  );
}
