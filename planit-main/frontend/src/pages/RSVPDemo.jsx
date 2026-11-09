import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, MapPin, Check, ArrowLeft, ExternalLink, Sparkles, Share2, User, Mail } from 'lucide-react';
import EventCountdown from '../components/EventCountdown';
import GuestAvatarStack from '../components/GuestAvatarStack';
import ShareCardModal from '../components/ShareCardModal';

const SAMPLE_EVENT = {
  title: 'Bonfire & vinyl',
  location: 'Rooftop, 214 Elm St',
  date: new Date(Date.now() + 9 * 86400000 + 5 * 3600000).toISOString(),
  subdomain: 'bonfire-vinyl',
};
const ACCENT = '#6366f1';
const SAMPLE_GUEST_NAMES = ['Ava', 'Marcus', 'Jules', 'Priya', 'Dev'];

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider px-3 py-1 rounded-full border border-blue-700 bg-blue-50">
      <Sparkles className="w-3 h-3" /> Live demo
    </span>
  );
}

function RSVPForm({ onSubmit }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [response, setResponse] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !response) return;
    onSubmit({ name: name.trim(), email, response, plusOnes });
  };

  return (
    <form onSubmit={submit} className="w-full max-w-md mx-auto space-y-5" style={{ color: '#fff' }}>
      <div className="text-center mb-2">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-2">You're invited to</p>
        <h1 className="text-3xl font-black mb-3">{SAMPLE_EVENT.title}</h1>
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mb-1">
          <Calendar className="w-4 h-4" />
          {new Date(SAMPLE_EVENT.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 mb-4">
          <MapPin className="w-4 h-4" /> {SAMPLE_EVENT.location}
        </div>
        <div className="flex justify-center mb-2">
          <EventCountdown date={SAMPLE_EVENT.date} accent={ACCENT} compact />
        </div>
        <div className="flex justify-center mt-3">
          <GuestAvatarStack names={SAMPLE_GUEST_NAMES} label="126 going" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none border-2 border-ink focus:ring-[3px] focus:ring-ac bg-white"
            style={{ background: '#ffffff', border: '2px solid #0d0e1c', color: '#0d0e1c' }}
          />
        </div>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none border-2 border-ink focus:ring-[3px] focus:ring-ac bg-white"
            style={{ background: '#ffffff', border: '2px solid #0d0e1c', color: '#0d0e1c' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[['yes', 'Going'], ['maybe', 'Maybe'], ['no', "Can't go"]].map(([val, label]) => (
            <button
              type="button" key={val} onClick={() => setResponse(val)}
              className="py-3 rounded-xl text-sm font-semibold border-2 transition-all border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition"
              style={response === val
                ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
                : { background: '#ffffff', borderColor: '#0d0e1c', color: '#5a5d70' }}
            >
              {label}
            </button>
          ))}
        </div>

        {response === 'yes' && (
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-sm text-neutral-400">Bringing anyone?</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPlusOnes((n) => Math.max(0, n - 1))} className="w-8 h-8 rounded-full border-2 border-ink text-neutral-300">-</button>
              <span className="text-sm font-medium w-4 text-center">{plusOnes}</span>
              <button type="button" onClick={() => setPlusOnes((n) => Math.min(5, n + 1))} className="w-8 h-8 rounded-full border-2 border-ink text-neutral-300">+</button>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit" disabled={!name.trim() || !response}
        className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
        style={{ background: ACCENT, color: '#fff' }}
      >
        Submit RSVP
      </button>
      <p className="text-center text-xs text-neutral-600">Nothing here is saved — this is a sandbox.</p>
    </form>
  );
}

function DemoConfirmation({ guest, onReset }) {
  const [showShareCard, setShowShareCard] = useState(false);
  const label = { yes: "You're on the list", maybe: 'Marked as maybe', no: "You're marked as not attending" }[guest.response];

  return (
    <div className="w-full max-w-md mx-auto text-center space-y-6" style={{ color: '#fff' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: `${ACCENT}22`, border: `2px solid ${ACCENT}` }}>
        <Check style={{ color: ACCENT }} className="w-10 h-10" />
      </div>
      <div>
        <h1 className="text-3xl font-black mb-3">{label}</h1>
        <p className="text-sm leading-relaxed opacity-70">
          {guest.response === 'yes'
            ? `Thanks, ${guest.name.split(' ')[0]} — we'll see you there${guest.plusOnes ? ` (plus ${guest.plusOnes})` : ''}.`
            : `Thanks for letting us know, ${guest.name.split(' ')[0]}.`}
        </p>
      </div>
      <div className="space-y-2.5">
        <button
          onClick={() => setShowShareCard(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: '#ffffff', border: '2px solid #0d0e1c', color: 'inherit' }}
        >
          <Share2 className="w-4 h-4" /> Share event
        </button>
        <button onClick={onReset} className="w-full text-xs opacity-50 hover:opacity-70 transition-opacity mt-2">
          Try the form again
        </button>
      </div>
      <p className="text-xs opacity-30 mt-6">Powered by <a href="/" className="underline hover:opacity-60">PlanIt</a></p>

      <ShareCardModal
        open={showShareCard}
        onClose={() => setShowShareCard(false)}
        eventTitle={SAMPLE_EVENT.title}
        dateLabel={new Date(SAMPLE_EVENT.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        location={SAMPLE_EVENT.location}
        guestName={guest.response === 'yes' ? guest.name : undefined}
        goingCount={127}
        url={`https://planitapp.onrender.com/rsvp/${SAMPLE_EVENT.subdomain}`}
      />
    </div>
  );
}

export default function RSVPDemo() {
  const [guest, setGuest] = useState(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#ffffff' }}>
      <div className="border-b border-ink px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-sm text-neutral-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to PlanIt
        </a>
        <DemoBadge />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {!guest ? (
            <motion.div key="form"   exit={{ opacity: 0, y: -16 }} >
              <RSVPForm onSubmit={setGuest} />
            </motion.div>
          ) : (
            <motion.div key="confirm"   >
              <DemoConfirmation guest={guest} onReset={() => setGuest(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-6 pb-10">
        <div className="max-w-md mx-auto p-6 rounded-2xl border border-blue-700 bg-blue-50 text-center">
          <p className="text-ink font-bold mb-1">This is the page every guest sees.</p>
          <p className="text-sm text-neutral-500 mb-4">Custom colors, fonts, and background per event — password protection and waitlisting too.</p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
            Create your event <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
