/**
 * frontend/src/components/tour/OrganizerPanelMock.jsx
 *
 * Inert mock of the "Organizer" card that sits beside the event in EventSpace.jsx
 * (the one with the green "Event Settings" button). Shared by the Standard and
 * Enterprise tours so both can point at the real settings entry point.
 */
import { Sliders, UserCheck, MapPin } from 'lucide-react';

export default function OrganizerPanelMock({ enterprise = false }) {
  return (
    <div data-tour="org-panel" className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2 cursor-pointer"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1 pt-1 pb-0.5">Organizer</p>
      {enterprise && (
        <div className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-indigo-600 text-white rounded-xl font-bold">
          <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />Guest Check-in
        </div>
      )}
      <div className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-violet-600 text-white rounded-xl font-bold">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />Set Up Seating
      </div>
      <div data-tour="org-settings" className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-emerald-600 text-white rounded-xl font-bold relative">
        <Sliders className="w-3.5 h-3.5 flex-shrink-0" />Event Settings
        <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-black bg-red-500 text-white rounded-full ring-2 ring-white">2</span>
      </div>
    </div>
  );
}
