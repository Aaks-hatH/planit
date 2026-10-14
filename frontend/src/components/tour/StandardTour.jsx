/**
 * frontend/src/components/tour/StandardTour.jsx
 *
 * Recreated (inert) mock of the standard EventSpace.jsx header + tab bar,
 * driven by TourEngine. Mirrors the real markup/classes closely (see
 * pages/EventSpace.jsx header + `tabs.map` block) so the highlight ring
 * lands on something that looks exactly like the real thing, rather than
 * an abstract card unrelated to the actual UI.
 */
import {
  MessageSquare, BarChart3, FileText, Clock, Users, CheckCircle2,
  Megaphone, DollarSign, StickyNote, Share2, QrCode, Copy, LogOut,
  HelpCircle,
} from 'lucide-react';
import TourEngine from './TourEngine';

const TABS = [
  { id: 'chat',          label: 'Chat',    icon: MessageSquare, count: 12 },
  { id: 'polls',         label: 'Polls',   icon: BarChart3,     count: 2  },
  { id: 'files',         label: 'Files',   icon: FileText,      count: 4  },
  { id: 'agenda',        label: 'Agenda',  icon: Clock,         count: 3  },
  { id: 'people',        label: 'People',  icon: Users,         count: 18 },
  { id: 'tasks',         label: 'Tasks',   icon: CheckCircle2,  count: 0  },
  { id: 'announcements', label: 'Bulletin',icon: Megaphone,     count: 0  },
  { id: 'expenses',      label: 'Budget',  icon: DollarSign,    count: 0  },
  { id: 'notes',         label: 'Notes',   icon: StickyNote,    count: 0  },
  { id: 'utilities',     label: 'Share',   icon: Share2,        count: 0  },
];

const STEPS = [
  { id: 'hdr-title',  title: 'Your event link', body: 'This is your event\u2019s name and live link at the top of every page. Tap it to copy the URL your guests use to join \u2014 works as a custom subdomain if you set one up.' },
  { id: 'hdr-online', title: 'Who\u2019s here right now', body: 'The green dot shows how many people are viewing the event space live \u2014 handy for knowing when to post an update everyone will actually see.' },
  { id: 'hdr-qr',     title: 'QR code', body: 'Generates a scannable code for your event link. Great for printing on flyers or displaying at check-in so people can join without typing anything.' },
  { id: 'hdr-copy',   title: 'Copy link', body: 'One tap copies your event link to the clipboard so you can drop it straight into a text, email, or group chat.' },
  { id: 'hdr-help',   title: 'Help center', body: 'Stuck on anything? This opens PlanIt\u2019s help center in a new tab \u2014 and you can always reopen this tour later from the same spot.' },
  { id: 'tab-chat',          title: 'Chat', body: 'A live group chat for everyone in the event. Good for quick coordination \u2014 questions, reminders, last-minute changes \u2014 without starting a separate group text.' },
  { id: 'tab-polls',         title: 'Polls', body: 'Create a poll to vote on dates, locations, or anything else that needs a group decision. Results update live as people vote.' },
  { id: 'tab-files',         title: 'Files', body: 'Share documents, images, or spreadsheets with everyone in the event \u2014 one shared folder instead of scattered email attachments.' },
  { id: 'tab-agenda',        title: 'Agenda', body: 'Lay out the schedule for your event \u2014 time-blocked items everyone can see, so there\u2019s no confusion about what happens when.' },
  { id: 'tab-people',        title: 'People', body: 'See everyone who\u2019s joined and who\u2019s RSVP\u2019d yes, maybe, or no. You can follow up with anyone who hasn\u2019t responded yet.' },
  { id: 'tab-tasks',         title: 'Tasks', body: 'Assign to-dos to specific people and track what\u2019s done. Useful for splitting up planning work \u2014 who\u2019s bringing what, who\u2019s booking what.' },
  { id: 'tab-announcements', title: 'Bulletin', body: 'Post important updates that stay pinned and visible, instead of getting buried in the chat scroll.' },
  { id: 'tab-expenses',      title: 'Budget', body: 'Track shared costs and who owes what \u2014 useful for anything with split expenses, from a road trip to a group gift.' },
  { id: 'tab-notes',         title: 'Notes', body: 'A shared notes space for anything that doesn\u2019t fit elsewhere \u2014 planning details, ideas, or things to remember.' },
  { id: 'tab-utilities',     title: 'Share & discovery', body: 'Get your link, a QR code, and one-tap social sharing. If your event is public, this is also where you make it discoverable to anyone browsing PlanIt.' },
];

export default function StandardTour({ onClose }) {
  return (
    <div className="fixed inset-0 z-[290] bg-neutral-50 overflow-y-auto">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div data-tour="hdr-title" className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 truncate leading-tight">Sam\u2019s Birthday Weekend</p>
              <p className="text-[11px] text-neutral-400 truncate">planit.app/e/sams-birthday</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div data-tour="hdr-online" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold text-emerald-700 cursor-pointer"
              style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              6 online
            </div>
            <div data-tour="hdr-qr" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer">
              <QrCode className="w-3.5 h-3.5 text-neutral-600" />
            </div>
            <div data-tour="hdr-copy" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer">
              <Copy className="w-3.5 h-3.5 text-neutral-600" />
            </div>
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center opacity-40">
              <LogOut className="w-3.5 h-3.5 text-neutral-500" />
            </div>
            <div data-tour="hdr-help" className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Tabs */}
          <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-hide" style={{ background: '#fafafa' }}>
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <div key={id} data-tour={`tab-${id}`}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 flex-shrink-0 cursor-pointer ${
                  id === 'chat' ? 'text-neutral-900 border-neutral-900 bg-white' : 'text-neutral-500 border-transparent hover:text-neutral-800'
                }`}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${id === 'chat' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
                    {count}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Sample chat panel, purely for visual context */}
          <div className="p-5 flex flex-col gap-3" style={{ minHeight: 360 }}>
            {[
              { name: 'Priya', text: 'Should we do Saturday or Sunday for the hike?', me: false },
              { name: 'You',   text: 'Saturday works better for most people I think', me: true },
              { name: 'Marcus',text: 'Saturday +1, I checked the poll', me: false },
            ].map((m, idx) => (
              <div key={idx} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${m.me ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'}`}>
                  {!m.me && <p className="text-[11px] font-bold text-neutral-500 mb-0.5">{m.name}</p>}
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <TourEngine steps={STEPS} onClose={onClose} accent="#6366f1" eyebrow="Standard Event Tour" />
    </div>
  );
}
