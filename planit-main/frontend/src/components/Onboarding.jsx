import { useState, useEffect } from 'react';
import {
  ArrowRight, X, Link, Copy, Check, MessageSquare, BarChart3,
  Users, CheckCircle2, Globe, Image, Palette, Share2,
  QrCode, Zap, UtensilsCrossed, Layers, MapPin, ClipboardList
} from 'lucide-react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function CopyBox({ link }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2 p-3 bg-neutral-900 rounded-xl border border-neutral-700 mt-3">
      <Link className="w-4 h-4 text-neutral-500 flex-shrink-0" />
      <span className="flex-1 text-sm text-neutral-300 font-mono truncate">{link}</span>
      <button onClick={handle}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          copied ? 'bg-emerald-500 text-white' : 'bg-white text-neutral-900 hover:bg-neutral-100'
        }`}>
        {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
      </button>
    </div>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300 ${
          i === current ? 'w-6 h-2 bg-white' : i < current ? 'w-2 h-2 bg-neutral-400' : 'w-2 h-2 bg-neutral-700'
        }`} />
      ))}
    </div>
  );
}

function StepIcon({ icon: Icon, color }) {
  const cls = {
    emerald: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400',
    blue:    'bg-blue-500/15 border-blue-500/25 text-blue-400',
    violet:  'bg-violet-500/15 border-violet-500/25 text-violet-400',
    orange:  'bg-orange-500/15 border-orange-500/25 text-orange-400',
    amber:   'bg-amber-500/15 border-amber-500/25 text-amber-400',
  }[color] || 'bg-neutral-800 border-neutral-700 text-neutral-400';
  return (
    <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-5 ${cls}`}>
      <Icon className="w-8 h-8" />
    </div>
  );
}

function CheckList({ items, color = 'neutral' }) {
  const iconCls = {
    emerald: 'text-emerald-400', orange: 'text-orange-400',
    violet: 'text-violet-400',   blue: 'text-blue-400',
    amber: 'text-amber-400',
  }[color] || 'text-neutral-400';
  return (
    <div className="text-left space-y-2.5 mb-6">
      {items.map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-start gap-3 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
          <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
          </div>
          <p className="text-sm text-neutral-300 leading-snug">{text}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Mode-specific step content ───────────────────────────────────────────────

// Standard
const StandardWelcome = ({ link }) => (
  <div className="text-center">
    <StepIcon icon={CheckCircle2} color="emerald" />
    <CopyBox link={link} />
  </div>
);

const StandardFeatures = () => (
  <div className="grid grid-cols-2 gap-3">
    {[
      { icon: MessageSquare, label: 'Real-time chat',   desc: 'Talk with your team in one thread' },
      { icon: BarChart3,     label: 'Polls & voting',   desc: 'Vote on options, track results live' },
      { icon: CheckCircle2, label: 'Tasks & deadlines', desc: 'Assign work and track completion' },
      { icon: Users,         label: 'RSVP management',  desc: 'See who is coming and follow up' },
      { icon: QrCode,        label: 'QR check-in',      desc: 'Professional check-in on the day' },
      { icon: Image,         label: 'File sharing',     desc: 'Upload docs, images, spreadsheets' },
    ].map(({ icon: Icon, label, desc }) => (
      <div key={label} className="p-3 rounded-2xl border border-neutral-800 bg-neutral-900/60">
        <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-neutral-400" />
        </div>
        <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
        <p className="text-xs text-neutral-500 leading-snug">{desc}</p>
      </div>
    ))}
  </div>
);

const StandardShare = ({ link }) => {
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join my event: ${link}`)}`;
  const sc = `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(link)}`;
  return (
    <div className="text-center">
      <StepIcon icon={Share2} color="blue" />
      <CopyBox link={link} />
      <div className="grid grid-cols-2 gap-3 mt-4">
        <a href={tw} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-700/60 transition-all group">
          <svg className="w-4 h-4 text-neutral-300 group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-sm font-medium text-neutral-300 group-hover:text-white">Share on X</span>
        </a>
        <a href={sc} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3 rounded-xl border border-yellow-800/40 bg-yellow-950/20 hover:bg-yellow-900/30 transition-all">
          <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.166 2c.742 0 3.292.204 4.502 2.835.388.83.295 2.232.23 3.219l-.004.063-.008.147c.229-.04.48-.107.67-.197a.98.98 0 0 1 .42-.093c.208 0 .404.053.564.148.337.197.52.53.52.917 0 .515-.352.942-.95 1.154l-.186.059c-.301.086-.752.215-.87.562-.063.182-.037.382.078.576l.007.013c.547 1.08 1.655 2.295 3.545 2.622.091.016.163.082.173.17a.214.214 0 0 1-.128.214c-.357.143-1.062.258-1.936.34-.065.008-.115.057-.122.12-.017.145-.028.297-.028.455l.006.157.003.04c.01.089-.053.17-.145.184l-.23.018c-.354 0-.747-.109-1.197-.33-.542-.266-1.098-.405-1.652-.405-.225 0-.448.024-.666.073-.358.08-.69.266-.998.557-.606.573-1.245.863-1.9.863-.654 0-1.293-.29-1.9-.863-.308-.29-.64-.477-.998-.557a3.573 3.573 0 0 0-.666-.073c-.554 0-1.11.139-1.652.405-.45.221-.843.33-1.197.33l-.23-.018a.176.176 0 0 1-.145-.184l.003-.04.006-.157c0-.158-.011-.31-.028-.455-.007-.063-.057-.112-.122-.12-.874-.082-1.579-.197-1.936-.34a.214.214 0 0 1-.128-.214.183.183 0 0 1 .173-.17c1.89-.327 2.998-1.542 3.545-2.622l.007-.013c.115-.194.14-.394.078-.576-.118-.347-.569-.476-.87-.562l-.186-.059c-.598-.212-.95-.639-.95-1.154 0-.387.183-.72.52-.917.16-.095.356-.148.564-.148a.98.98 0 0 1 .42.093c.197.093.454.16.69.198l-.012-.21c-.065-.987-.158-2.388.23-3.218C8.874 2.204 11.424 2 12.166 2z"/>
          </svg>
          <span className="text-sm font-medium text-yellow-400">Snapchat</span>
        </a>
      </div>
    </div>
  );
};

const StandardDiscovery = () => (
  <div className="text-center">
    <StepIcon icon={Globe} color="violet" />
    <CheckList color="violet" items={[
      { icon: Globe,   text: 'Toggle "Public Event" in Settings → Features' },
      { icon: Image,   text: 'Upload a cover image from Settings → Theme' },
      { icon: Palette, text: 'Pick a theme color to match your brand' },
    ]} />
  </div>
);

// Enterprise
const EnterpriseWelcome = ({ link }) => (
  <div className="text-center">
    <StepIcon icon={Zap} color="violet" />
    <p className="text-sm text-neutral-400 mb-4">
      Enterprise mode gives every guest a personalised QR invite. Start by adding your guest list.
    </p>
    <div className="p-4 bg-violet-500/8 border border-violet-500/20 rounded-2xl text-left">
      <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-1">Your event link</p>
      <CopyBox link={link} />
      <p className="text-xs text-neutral-600 mt-2">Share this with co-organisers — guests each get their own invite link.</p>
    </div>
  </div>
);

const EnterpriseGuests = () => (
  <div>
    <StepIcon icon={Users} color="violet" />
    <CheckList color="violet" items={[
      { icon: ClipboardList, text: 'Go to the "Guests" tab → "Manage Invites"' },
      { icon: Users,         text: 'Add each guest: name, email, and group size' },
      { icon: QrCode,        text: 'Each guest gets a unique invite link with their own QR code' },
      { icon: BarChart3,     text: 'Watch attendance fill in on the Analytics tab in real time' },
    ]} />
  </div>
);

const EnterpriseCheckin = () => (
  <div>
    <StepIcon icon={QrCode} color="emerald" />
    <CheckList color="emerald" items={[
      { icon: QrCode,    text: 'Open the Check-In tab on event day — scan each guest\'s QR code' },
      { icon: Zap,       text: 'Blocked or flagged guests get a manager override prompt' },
      { icon: BarChart3, text: 'Live attendance stats update as guests arrive' },
    ]} />
    <div className="p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
      <p className="text-xs text-emerald-400 font-medium">💡 Works offline — check in guests without wi-fi and sync when reconnected.</p>
    </div>
  </div>
);

// Venue
const VenueWelcome = ({ link }) => (
  <div className="text-center">
    <StepIcon icon={UtensilsCrossed} color="orange" />
    <p className="text-sm text-neutral-400 mb-4">
      Your floor management system is ready. Set up your layout and go live.
    </p>
    <div className="p-4 bg-orange-500/8 border border-orange-500/20 rounded-2xl text-left">
      <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Your venue link</p>
      <CopyBox link={link} />
      <p className="text-xs text-neutral-600 mt-2">Staff log in at <code className="text-neutral-500">/login</code> using their credentials.</p>
    </div>
  </div>
);

const VenueSetup = () => (
  <div>
    <StepIcon icon={Layers} color="orange" />
    <CheckList color="orange" items={[
      { icon: Layers,       text: 'Click "Edit Layout" in your floor dashboard to start' },
      { icon: MapPin,       text: 'Drag tables to match your restaurant\'s physical layout' },
      { icon: Users,        text: 'Set each table\'s capacity and give it a label' },
      { icon: CheckCircle2, text: 'Open Settings to configure dining duration, buffer, and hours' },
    ]} />
  </div>
);

const VenueStaff = () => (
  <div>
    <StepIcon icon={Users} color="amber" />
    <CheckList color="amber" items={[
      { icon: Users,  text: 'Go to Settings → Staff to create individual staff accounts' },
      { icon: MapPin, text: 'Staff log in at /login and go straight to the live floor view' },
      { icon: QrCode, text: 'Print or display the waitlist QR at your door — guests join from their phone' },
    ]} />
    <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
      <p className="text-xs text-amber-400 font-medium">💡 Your floor data never auto-deletes. Tables, history, and settings persist forever.</p>
    </div>
  </div>
);

// ─── Step config ──────────────────────────────────────────────────────────────

function getSteps(isEnterprise, isVenue) {
  if (isVenue) return [
    { title: 'Your venue is live',      subtitle: 'Time to build your floor plan.' },
    { title: 'Set up your floor',       subtitle: 'Add tables to match your layout.' },
    { title: 'Get your team in',        subtitle: 'Staff can log in right from the floor screen.' },
  ];
  if (isEnterprise) return [
    { title: 'Enterprise event created', subtitle: 'Start adding guests and sending personalised QR invites.' },
    { title: 'Add your guest list',      subtitle: 'Each guest gets a unique invite with their own QR code.' },
    { title: 'Day-of check-in',          subtitle: 'Scan QR codes at the door and track attendance live.' },
  ];
  return [
    { title: 'Your event is live',      subtitle: 'Share the link with your team and start planning.' },
    { title: 'Everything in one place', subtitle: 'Your event comes fully loaded — no setup needed.' },
    { title: 'Spread the word',         subtitle: 'Invite your team with a link, QR code, or social share.' },
    { title: 'Make it discoverable',    subtitle: 'Public events appear on Discover for anyone to join.' },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Onboarding({ eventId, subdomain, isOrganizer, isEnterprise, isVenue, onClose }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  const link = subdomain
    ? `${window.location.origin}/e/${subdomain}`
    : `${window.location.origin}/event/${eventId}`;

  const steps = getSteps(isEnterprise, isVenue);

  const accentGradient = isVenue
    ? 'linear-gradient(90deg, #f97316, #fb923c, #fbbf24)'
    : isEnterprise
      ? 'linear-gradient(90deg, #7c3aed, #8b5cf6, #a78bfa)'
      : 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)';

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };
  const next = () => step < steps.length - 1 ? setStep(s => s + 1) : handleClose();

  const renderContent = () => {
    if (isVenue) {
      if (step === 0) return <VenueWelcome link={link} />;
      if (step === 1) return <VenueSetup />;
      return <VenueStaff />;
    }
    if (isEnterprise) {
      if (step === 0) return <EnterpriseWelcome link={link} />;
      if (step === 1) return <EnterpriseGuests />;
      return <EnterpriseCheckin />;
    }
    if (step === 0) return <StandardWelcome link={link} />;
    if (step === 1) return <StandardFeatures />;
    if (step === 2) return <StandardShare link={link} />;
    return <StandardDiscovery />;
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-md rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden transition-all duration-300 ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        style={{ background: '#0f0f17' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: accentGradient }} />

        {(isEnterprise || isVenue) && (
          <div className="absolute top-4 left-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              isVenue ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'bg-violet-500/10 border border-violet-500/20 text-violet-400'
            }`}>
              {isVenue ? <UtensilsCrossed className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {isVenue ? 'Venue' : 'Enterprise'}
            </span>
          </div>
        )}

        <button onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-all z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="p-8 pt-10">
          <ProgressDots total={steps.length} current={step} />

          <div className="text-center mb-6">
            <h2 className="font-display text-2xl font-black text-white mb-2">{steps[step].title}</h2>
            <p className="text-neutral-400 text-sm">{steps[step].subtitle}</p>
          </div>

          <div className="transition-all duration-200">{renderContent()}</div>

          <div className="flex items-center justify-between mt-8">
            <button onClick={handleClose} className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors">
              Skip
            </button>
            <button onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all duration-200">
              {step === steps.length - 1 ? 'Get started' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}