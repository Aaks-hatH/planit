/**
 * frontend/src/components/tour/EnterpriseTour.jsx
 *
 * Recreated (inert) mock of EventSpace.jsx in Enterprise mode: same tab
 * bar as the standard tour plus the Enterprise banner, the Check-in
 * header button, and the Analytics tab (see EventSpace.jsx lines around
 * `event?.isEnterpriseMode` for the real equivalents).
 */
import {
  MessageSquare, BarChart3, FileText, Clock, Users, CheckCircle2,
  Megaphone, DollarSign, StickyNote, Share2, QrCode, Copy, UserCheck,
} from 'lucide-react';
import TourEngine from './TourEngine';

const TABS = [
  { id: 'chat',          label: 'Chat',      icon: MessageSquare, count: 4 },
  { id: 'polls',         label: 'Polls',     icon: BarChart3,     count: 1 },
  { id: 'files',         label: 'Files',     icon: FileText,      count: 6 },
  { id: 'agenda',        label: 'Agenda',    icon: Clock,         count: 5 },
  { id: 'people',        label: 'People',    icon: Users,         count: 240 },
  { id: 'tasks',         label: 'Tasks',     icon: CheckCircle2,  count: 0 },
  { id: 'announcements', label: 'Bulletin',  icon: Megaphone,     count: 0 },
  { id: 'expenses',      label: 'Budget',    icon: DollarSign,    count: 0 },
  { id: 'notes',         label: 'Notes',     icon: StickyNote,    count: 0 },
  { id: 'analytics',     label: 'Analytics', icon: BarChart3,     count: 0 },
  { id: 'utilities',     label: 'Share',     icon: Share2,        count: 0 },
];

const STEPS = [
  { id: 'banner',     title: 'Enterprise mode', body: 'This badge means every guest gets their own personalised invite with a unique QR code \u2014 not one shared link. It\u2019s built for large events where you need to know exactly who showed up.' },
  { id: 'hdr-checkin', title: 'Check-in', body: 'Opens your check-in console \u2014 scan each guest\u2019s personal QR code as they arrive and watch attendance update live.' },
  { id: 'hdr-title',  title: 'Your event', body: 'Your event name and organiser link. Co-organisers use this to get into the dashboard \u2014 guests instead get individual invite links, not this one.' },
  { id: 'hdr-qr',     title: 'Master QR', body: 'A general QR code for the event itself \u2014 useful for signage, separate from each guest\u2019s personal invite QR.' },
  { id: 'tab-people',        title: 'People & invites', body: 'This is where you add your guest list and PlanIt generates a unique QR invite for each person automatically \u2014 no manual QR creation needed.' },
  { id: 'tab-analytics',     title: 'Analytics', body: 'Enterprise-only tab: see RSVP trends, check-in rates, and attendance over time as your event approaches \u2014 useful for staffing and catering decisions.' },
  { id: 'tab-chat',          title: 'Chat', body: 'Live group chat for organisers and guests to coordinate \u2014 same as a standard event.' },
  { id: 'tab-polls',         title: 'Polls', body: 'Run a vote on logistics \u2014 session times, meal options, anything the group should decide together.' },
  { id: 'tab-files',         title: 'Files', body: 'Share documents, schedules, or slide decks with everyone attached to the event.' },
  { id: 'tab-agenda',        title: 'Agenda', body: 'Lay out a time-blocked schedule \u2014 especially useful for multi-session enterprise events like conferences.' },
  { id: 'tab-tasks',         title: 'Tasks', body: 'Assign setup, staffing, or logistics tasks to your team and track what\u2019s completed.' },
  { id: 'tab-announcements', title: 'Bulletin', body: 'Pin important updates so they don\u2019t get lost in chat \u2014 gate changes, schedule shifts, anything time-sensitive.' },
  { id: 'tab-expenses',      title: 'Budget', body: 'Track event costs and who\u2019s responsible for what \u2014 useful when multiple departments are splitting a budget.' },
  { id: 'tab-notes',         title: 'Notes', body: 'A shared space for planning notes that don\u2019t belong anywhere else.' },
  { id: 'tab-utilities',     title: 'Share', body: 'Get your master link and QR code for signage or marketing \u2014 remember, individual guests still check in with their own personal invite.' },
];

export default function EnterpriseTour({ onClose }) {
  return (
    <div className="fixed inset-0 z-[290] bg-neutral-50 overflow-y-auto">
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div data-tour="hdr-title" className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">A</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 truncate leading-tight">Annual Sales Kickoff</p>
              <p className="text-[11px] text-neutral-400 truncate">planit.app/e/sales-kickoff</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div data-tour="hdr-qr" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer">
              <QrCode className="w-3.5 h-3.5 text-neutral-600" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center opacity-40">
              <Copy className="w-3.5 h-3.5 text-neutral-600" />
            </div>
            <div data-tour="hdr-checkin" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
              <UserCheck className="w-3.5 h-3.5" />Check-in
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3">
        <div data-tour="banner" className="p-4 rounded-2xl flex items-center justify-between gap-4 text-white cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#1e3a5f,#1a1a2e)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Enterprise Mode</h3>
              <p className="text-xs opacity-50">Manage guest invites and check-in</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-neutral-900 rounded-xl font-bold text-xs flex-shrink-0">
            <UserCheck className="w-3.5 h-3.5" />Manage
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-hide" style={{ background: '#fafafa' }}>
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <div key={id} data-tour={`tab-${id}`}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 flex-shrink-0 cursor-pointer ${
                  id === 'people' ? 'text-neutral-900 border-neutral-900 bg-white' : 'text-neutral-500 border-transparent hover:text-neutral-800'
                }`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${id === 'people' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                    {count}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-5 flex flex-col gap-2" style={{ minHeight: 360 }}>
            {[
              { name: 'Elena Ruiz',   status: 'Checked in',  color: 'emerald' },
              { name: 'David Okafor', status: 'Invited',     color: 'neutral' },
              { name: 'Mei Chen',     status: 'Checked in',  color: 'emerald' },
            ].map((g, idx) => (
              <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-sm font-semibold text-neutral-800">{g.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${g.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TourEngine steps={STEPS} onClose={onClose} accent="#7c3aed" eyebrow="Enterprise Event Tour" />
    </div>
  );
}
