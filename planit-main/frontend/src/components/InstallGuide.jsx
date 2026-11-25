import { useState, useEffect } from 'react';
import toast from '../utils/toast';
import {
  Share, PlusSquare, MoreVertical, Download, Smartphone, Tablet, Laptop, Monitor,
  CheckCircle2, Copy, AlertTriangle, Info, Loader2, WifiOff,
} from 'lucide-react';
import Sheet from './ui/Sheet';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * InstallGuide
 * A short, step-by-step "how to install" sheet. It opens on the steps for the device and browser the
 * person is using and lets them switch to another device's steps. It never depends on whether the
 * install banner was dismissed, so it is always available from the "Install the app" button.
 *
 * Browsers install web apps differently, which is why each one has its own steps:
 *   iPhone Safari, iPad Safari, Chrome on iPhone, Android, Mac Safari, and computer Chrome / Edge.
 */

// A small picture of the button to look for, so people can match it against their screen.
function KeyChip({ icon: Icon, label }) {
  return (
    <span className="mt-2.5 inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-semibold text-neutral-800">
      {Icon && <Icon className="h-4 w-4 text-neutral-600" aria-hidden="true" />}
      {label}
    </span>
  );
}

const GUIDES = {
  iphone: {
    tab: 'iPhone', heading: 'Safari on iPhone', icon: Smartphone,
    steps: (app) => [
      { title: 'Tap the Share button', body: 'Look for the square with an arrow pointing up. It is in Safari\u2019s toolbar, or under the \u22EF button on newer versions of iOS.', chip: { icon: Share, label: 'Share' } },
      { title: 'Choose Add to Home Screen', body: 'Scroll down the menu if you cannot see it. Still missing? Tap View More.', chip: { icon: PlusSquare, label: 'Add to Home Screen' } },
      { title: 'Tap Add', body: `Leave \u201COpen as Web App\u201D switched on if you see it. ${app} now sits on your Home Screen like any other app.`, chip: { label: 'Add' } },
    ],
  },
  ipad: {
    tab: 'iPad', heading: 'Safari on iPad', icon: Tablet,
    steps: (app) => [
      { title: 'Tap the Share button', body: 'It is at the top of Safari, next to the address bar: a square with an arrow pointing up.', chip: { icon: Share, label: 'Share' } },
      { title: 'Choose Add to Home Screen', body: 'Scroll the menu if you cannot see it.', chip: { icon: PlusSquare, label: 'Add to Home Screen' } },
      { title: 'Tap Add', body: `${app} now sits on your Home Screen and opens full screen.`, chip: { label: 'Add' } },
    ],
  },
  'iphone-chrome': {
    tab: 'Chrome on iPhone', heading: 'Chrome on iPhone', icon: Smartphone,
    requirement: 'Needs iOS 16.4 or newer. Chrome on iPad uses the same steps.',
    steps: (app) => [
      { title: 'Tap the Share button', body: 'In Chrome it is at the right end of the address bar. Not there? Tap the \u22EF menu and choose Share.', chip: { icon: Share, label: 'Share' } },
      { title: 'Choose Add to Home Screen', body: 'Scroll down the share menu to find it.', chip: { icon: PlusSquare, label: 'Add to Home Screen' } },
      { title: 'Tap Add', body: `${app} now sits on your Home Screen like any other app.`, chip: { label: 'Add' } },
    ],
    fallback: 'Do not see Add to Home Screen? Open this page in Safari instead and follow the iPhone steps.',
  },
  android: {
    tab: 'Android', heading: 'Chrome on Android', icon: Smartphone,
    steps: (app) => [
      { title: 'Open the browser menu', body: 'Tap the three dots in the top-right corner of Chrome. In Samsung Internet it is the \u2630 menu at the bottom.', chip: { icon: MoreVertical, label: 'Menu' } },
      { title: 'Tap Install app', body: 'Some phones say Add to Home screen instead. Either one works.', chip: { icon: Download, label: 'Install app' } },
      { title: 'Tap Install', body: `${app} now shows up on your Home Screen and in your app list.`, chip: { label: 'Install' } },
    ],
  },
  mac: {
    tab: 'Mac Safari', heading: 'Safari on Mac', icon: Laptop,
    requirement: 'Needs macOS Sonoma (14) or newer with Safari 17 or newer. On an older Mac, open PlanIt in Chrome or Edge instead.',
    steps: (app) => [
      { title: 'Click the Share button', body: 'It is in Safari\u2019s toolbar: a square with an arrow pointing up. You can also open the File menu.', chip: { icon: Share, label: 'Share' } },
      { title: 'Choose Add to Dock\u2026', body: 'It is in the Share menu and in the File menu.', chip: { icon: PlusSquare, label: 'Add to Dock\u2026' } },
      { title: 'Click Add', body: `${app} opens in its own window. Launch it from the Dock or Launchpad.`, chip: { label: 'Add' } },
    ],
  },
  desktop: {
    tab: 'Computer', heading: 'Chrome or Edge on a computer', icon: Monitor,
    steps: (app) => [
      { title: 'Find the install icon', body: 'At the right end of the address bar, look for a small screen with a down arrow. No icon? Open the browser menu and choose Install, or Apps \u2192 Install this site as an app in Edge.', chip: { icon: Download, label: 'Install' } },
      { title: 'Click Install', body: `${app} opens in its own window and gets its own icon in your Dock, taskbar or Start menu.`, chip: { label: 'Install' } },
    ],
  },
};
const ORDER = ['iphone', 'ipad', 'iphone-chrome', 'android', 'mac', 'desktop'];

export default function InstallGuide({ open, onClose, appName = 'PlanIt' }) {
  const { platform, isInstalled, canPromptNow, promptInstall } = useInstallPrompt();
  const detected = GUIDES[platform.id] ? platform.id : null;
  const [selected, setSelected] = useState(detected);
  const [busy, setBusy] = useState(false);

  // Every time the guide opens, start on this device's steps again.
  useEffect(() => { if (open) setSelected(detected); }, [open, detected]);

  const guide = selected ? GUIDES[selected] : null;
  const onThisDevice = selected && selected === detected;

  async function installNow() {
    setBusy(true);
    try {
      const r = await promptInstall({ rememberDismiss: false });
      if (r === 'accepted') { toast.success(`${appName} installed`); onClose?.(); }
    } finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied. Paste it into Safari.'); }
    catch { toast.error('Could not copy the link. Press and hold the address bar to copy it.'); }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Install ${appName}`}
      subtitle="Opens full screen and keeps working with a weak or no signal."
      icon={Download}
      size="md"
      footer={<button type="button" onClick={onClose} className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-neutral-900 text-base font-semibold text-white hover:bg-black active:bg-black">Done</button>}
    >
      {isInstalled && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <p><strong className="font-semibold">{appName} is already installed on this device.</strong> You can still use these steps to add it somewhere else.</p>
        </div>
      )}

      {platform.inApp && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />You are in an in-app browser</p>
          <p className="mt-1 leading-snug text-amber-900">Apps like Instagram and Facebook cannot install websites. Open this page in Safari or Chrome first, then come back to these steps.</p>
          <button type="button" onClick={copyLink} className="mt-2.5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-400 bg-white px-3.5 text-sm font-semibold text-amber-950 hover:bg-amber-100">
            <Copy className="h-4 w-4" aria-hidden="true" /> Copy link
          </button>
        </div>
      )}

      {/* Device picker. On a device we recognise it starts on that device's steps. */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {selected ? 'Your device' : 'Which device are you on?'}
      </p>
      <div role="tablist" aria-label="Choose your device" className={selected ? '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden' : 'grid grid-cols-2 gap-2'}>
        {ORDER.map((id) => {
          const g = GUIDES[id];
          const on = selected === id;
          const Icon = g.icon;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              ref={on ? (el) => { el?.scrollIntoView?.({ inline: 'center', block: 'nearest' }); } : undefined}
              onClick={() => setSelected(id)}
              className={`relative flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold transition-colors ${selected ? 'min-h-[44px] px-3.5' : 'min-h-[56px] px-4'} ${on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {g.tab}
              {id === detected && <span className={`ml-0.5 h-2 w-2 rounded-full ${on ? 'bg-emerald-400' : 'bg-emerald-500'}`} title="This device" aria-label="This device" />}
            </button>
          );
        })}
      </div>

      {!selected && (
        <p className="mt-3 text-sm leading-snug text-neutral-500">
          We could not tell which browser this is. Pick your device and follow the steps. If you are on an iPhone, iPad or Mac, Safari is the most reliable choice.
        </p>
      )}

      {guide && (
        <div role="tabpanel" aria-label={guide.heading} className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-bold text-neutral-900">{guide.heading}</h3>
            {onThisDevice && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />This device</span>}
            {!onThisDevice && detected && (
              <button type="button" onClick={() => setSelected(detected)} className="text-xs font-semibold text-blue-600 underline-offset-2 hover:underline">Back to my device</button>
            )}
          </div>

          {/* One-tap install where the browser offers it (Android, Chrome and Edge on a computer). */}
          {onThisDevice && canPromptNow && (selected === 'android' || selected === 'desktop') && (
            <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3.5">
              <button
                type="button"
                onClick={installNow}
                disabled={busy}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-base font-bold text-white hover:bg-blue-700 active:bg-blue-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}
                Install {appName} now
              </button>
              <p className="mt-2 text-center text-xs text-blue-900/80">Or follow the steps below.</p>
            </div>
          )}

          {guide.requirement && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-neutral-100 px-3 py-2.5 text-sm leading-snug text-neutral-700">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" aria-hidden="true" />{guide.requirement}
            </p>
          )}

          <ol className="space-y-3">
            {guide.steps(appName).map((s, i) => (
              <li key={s.title} className="flex gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white" aria-hidden="true">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug text-neutral-900">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
                  {s.chip && <KeyChip icon={s.chip.icon} label={s.chip.label} />}
                </div>
              </li>
            ))}
          </ol>

          {guide.fallback && (
            <div className="mt-3 rounded-2xl bg-neutral-100 p-3.5 text-sm leading-snug text-neutral-700">
              <p>{guide.fallback}</p>
              <button type="button" onClick={copyLink} className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy link for Safari
              </button>
            </div>
          )}

          <p className="mt-4 flex items-start gap-2 text-sm leading-snug text-neutral-500">
            <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            Installed, {appName} keeps your guest list and check-in working even when the signal drops.
          </p>
        </div>
      )}
    </Sheet>
  );
}
