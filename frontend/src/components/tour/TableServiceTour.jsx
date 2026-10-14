/**
 * frontend/src/components/tour/TableServiceTour.jsx
 *
 * Recreated (inert) mock of TableService.jsx's floor view \u2014 header,
 * status pills, floor map, and the right-hand Waitlist / Reservations /
 * Alerts / Overview sidebar (see pages/TableService.jsx around
 * `STATUS_META` and the `sideTab` render block for the real equivalents).
 */
import {
  Utensils, Bell, RefreshCw, Users, ScanLine, LayoutGrid, Settings,
} from 'lucide-react';
import TourEngine from './TourEngine';

const STATUS_META = {
  available: { label: 'Available', color: '#22c55e' },
  occupied:  { label: 'Occupied',  color: '#ef4444' },
  reserved:  { label: 'Reserved',  color: '#f59e0b' },
  cleaning:  { label: 'Cleaning',  color: '#8b5cf6' },
};

const TABLES = [
  { id: 1, status: 'occupied',  label: 'T1' },
  { id: 2, status: 'available', label: 'T2' },
  { id: 3, status: 'reserved',  label: 'T3' },
  { id: 4, status: 'cleaning',  label: 'T4' },
  { id: 5, status: 'occupied',  label: 'T5' },
  { id: 6, status: 'available', label: 'T6' },
];

const SIDE_TABS = [
  { id: 'waitlist',     label: 'Waitlist',     badge: 3 },
  { id: 'reservations', label: 'Reservations', badge: 5 },
  { id: 'alerts',       label: 'Alerts',       badge: 1 },
  { id: 'summary',      label: 'Overview',     badge: null },
];

const STEPS = [
  { id: 'hdr-title',  title: 'Your floor', body: 'Your restaurant or venue name, with a quick label reminding you which mode you\u2019re in.' },
  { id: 'status-pills', title: 'Live table counts', body: 'A running count of tables in each state \u2014 available, occupied, reserved, cleaning \u2014 so you can see the room\u2019s status at a glance without scanning the whole floor.' },
  { id: 'scan-qr',    title: 'Scan guest QR', body: 'Scans a guest\u2019s QR code to pull up their reservation or waitlist spot and seat them in one motion.' },
  { id: 'edit-layout', title: 'Edit Layout', body: 'Opens the floor editor \u2014 drag tables to match your real floor plan, set capacities, and label each one.' },
  { id: 'servers',    title: 'Server view', body: 'Opens the view your serving staff use \u2014 their assigned tables and live order status, in a new tab.' },
  { id: 'kitchen',    title: 'Kitchen display', body: 'Opens the kitchen\u2019s order display \u2014 what\u2019s been ordered and what\u2019s ready to go out.' },
  { id: 'settings',   title: 'Settings', body: 'Configure dining duration, buffer time, operating hours, staff accounts, and more.' },
  { id: 'table',      title: 'Managing a table', body: 'Tap any table to seat a party, mark it available, cleaning, or reserved, and reset it once a party leaves \u2014 all from one panel.' },
  { id: 'side-waitlist',     title: 'Waitlist', body: 'Everyone waiting for a table, with an estimated wait time. Seat the next party straight from here when a table opens up.' },
  { id: 'side-reservations', title: 'Reservations', body: 'Upcoming bookings for the day \u2014 add new ones or seat a reserved party manually when they arrive.' },
  { id: 'side-alerts',       title: 'Alerts', body: 'Live requests from guest tablets \u2014 needs assistance, ready to order, water refill \u2014 so nothing sits unanswered.' },
];

export default function TableServiceTour({ onClose }) {
  return (
    <div className="fixed inset-0 z-[290] bg-[#0a0a12] overflow-y-auto flex flex-col">
      <header className="flex-shrink-0 h-14 border-b border-neutral-800 bg-neutral-900/80 flex items-center px-4 gap-4">
        <div data-tour="hdr-title" className="flex items-center gap-3 min-w-0 cursor-pointer">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Utensils className="w-4 h-4 text-neutral-900" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-white text-sm truncate">The Garden Bistro</span>
            <span className="hidden sm:inline text-neutral-600 text-xs ml-2">Table Service</span>
          </div>
        </div>

        <div data-tour="status-pills" className="flex items-center gap-2 flex-1 overflow-x-auto cursor-pointer">
          {Object.entries(STATUS_META).map(([k, meta]) => (
            <div key={k} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold text-neutral-300"
              style={{ borderColor: `${meta.color}40`, background: `${meta.color}15` }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: meta.color }} />
              {TABLES.filter(t => t.status === k).length} {meta.label}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative p-2 rounded-lg cursor-pointer">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">1</span>
          </div>
          <div className="p-2 rounded-lg text-neutral-500 cursor-pointer"><RefreshCw className="w-4 h-4" /></div>
          <div data-tour="servers" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer">
            <Users className="w-3.5 h-3.5" />Servers
          </div>
          <div data-tour="kitchen" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer">
            <Utensils className="w-3.5 h-3.5" />Kitchen
          </div>
          <div data-tour="scan-qr" className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded-lg text-xs font-semibold cursor-pointer">
            <ScanLine className="w-3.5 h-3.5" />Scan QR
          </div>
          <div data-tour="edit-layout" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer">
            <LayoutGrid className="w-3.5 h-3.5" />Edit Layout
          </div>
          <div data-tour="settings" className="p-2 rounded-lg text-neutral-500 cursor-pointer"><Settings className="w-4 h-4" /></div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="grid grid-cols-3 gap-5">
            {TABLES.map((t) => (
              <div key={t.id} {...(t.id === 1 ? { 'data-tour': 'table' } : {})}
                className="w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-105"
                style={{ borderColor: STATUS_META[t.status].color, background: `${STATUS_META[t.status].color}18` }}>
                <span className="text-white font-bold text-sm">{t.label}</span>
                <span className="text-[10px] font-semibold mt-0.5" style={{ color: STATUS_META[t.status].color }}>{STATUS_META[t.status].label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">
          <div className="flex border-b border-neutral-800 flex-shrink-0">
            {SIDE_TABS.map(({ id, label, badge }) => (
              <div key={id} data-tour={id === 'summary' ? undefined : `side-${id}`}
                className={`flex-1 py-3 text-xs font-semibold border-b-2 cursor-pointer ${id === 'waitlist' ? 'text-white border-white' : 'text-neutral-500 border-transparent'}`}>
                {label}
                {badge > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-neutral-700 rounded-full text-[10px] font-bold text-white">{badge}</span>}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[
              { name: 'Nguyen party of 4', wait: '~10 min' },
              { name: 'Ortiz party of 2', wait: '~15 min' },
              { name: 'Baker party of 6', wait: '~25 min' },
            ].map((w, idx) => (
              <div key={idx} className="px-3 py-2.5 rounded-xl bg-neutral-800/60 border border-neutral-700/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200">{w.name}</span>
                <span className="text-[11px] text-amber-400 font-semibold">{w.wait}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TourEngine steps={STEPS} onClose={onClose} accent="#f97316" dark eyebrow="Table Service Tour" />
    </div>
  );
}
