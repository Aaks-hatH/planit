import { useState } from 'react';
import {
  MoreHorizontal, ChevronRight, UserPlus, Upload, Settings, MapPin, LayoutGrid, BarChart2, LogOut,
} from 'lucide-react';
import { ResponsivePanel } from './ui/Sheet';

/**
 * CheckinToolsMenu
 * The check-in header used to cram up to eight icon-only buttons into one row, which is what made the
 * phone layout so cramped. Everything that is not a door-time action now lives here, with a proper
 * label and a one-line explanation:
 *   phones   a bottom sheet with large rows
 *   desktop  a popover under the "More" button
 *
 * Organizers get guest, seating, log and settings tools. Staff get seating (when enabled) and log out.
 */
function Row({ icon: Icon, tone, label, desc, onClick, danger = false, mobileOnly = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${mobileOnly ? 'sm:hidden ' : ''}flex min-h-[60px] w-full items-center gap-3.5 rounded-2xl px-2.5 py-2.5 text-left transition-colors sm:min-h-[52px] ${danger ? 'hover:bg-red-50 active:bg-red-100' : 'hover:bg-neutral-50 active:bg-neutral-100'}`}
    >
      <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${tone}`}>
        <Icon className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-base font-semibold leading-tight sm:text-sm ${danger ? 'text-red-700' : 'text-neutral-900'}`}>{label}</span>
        {desc && <span className="mt-0.5 block text-sm leading-snug text-neutral-500 sm:text-xs">{desc}</span>}
      </span>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-neutral-300" aria-hidden="true" />
    </button>
  );
}

function Group({ label, children }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      {children}
    </div>
  );
}

export default function CheckinToolsMenu({
  role, seatingEnabled,
  onAddGuest, onImportCsv, onSettings, onSeating, onSetupSeating, onAssign, onActivityLog, onLogout,
}) {
  const [open, setOpen] = useState(false);
  const isOrganizer = role === 'organizer';
  const run = (fn) => () => { setOpen(false); fn?.(); };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        More
      </button>

      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title="More tools"
        subtitle={isOrganizer ? 'Guests, seating, activity and security' : 'Seating and account'}
        icon={MoreHorizontal}
        widthClass="w-[21rem]"
      >
        {isOrganizer && (
          <Group label="Guests">
            <Row mobileOnly icon={UserPlus} tone="bg-emerald-50 text-emerald-700" label="Add guest" desc="Create an invite and QR for one guest" onClick={run(onAddGuest)} />
            <Row icon={Upload} tone="bg-blue-50 text-blue-700" label="Import CSV" desc="Add many guests from a spreadsheet" onClick={run(onImportCsv)} />
          </Group>
        )}

        {(seatingEnabled || isOrganizer) && (
          <Group label="Seating">
            {seatingEnabled ? (
              <Row icon={MapPin} tone="bg-violet-50 text-violet-700" label="Seating map" desc={isOrganizer ? 'See and edit the floor plan' : 'See where tables are'} onClick={run(onSeating)} />
            ) : (
              <Row icon={MapPin} tone="bg-violet-50 text-violet-700" label="Set up seating" desc="Create a floor plan for this event" onClick={run(onSetupSeating)} />
            )}
            {isOrganizer && seatingEnabled && (
              <Row icon={LayoutGrid} tone="bg-violet-50 text-violet-700" label="Assign tables" desc="Seat many guests at once, set ticket types" onClick={run(onAssign)} />
            )}
          </Group>
        )}

        {isOrganizer && (
          <Group label="Event">
            <Row icon={BarChart2} tone="bg-neutral-100 text-neutral-700" label="Activity log" desc="Who did what, and when" onClick={run(onActivityLog)} />
            <Row icon={Settings} tone="bg-neutral-100 text-neutral-700" label="Security settings" desc="Anti-fraud rules and staff PINs" onClick={run(onSettings)} />
          </Group>
        )}

        {role === 'staff' && (
          <Group label="Account">
            <Row icon={LogOut} tone="bg-red-50 text-red-600" danger label="Log out" desc="Sign out of check-in on this device" onClick={run(onLogout)} />
          </Group>
        )}
      </ResponsivePanel>
    </div>
  );
}
