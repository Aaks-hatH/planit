import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Shield, QrCode, Share2, Check, ArrowLeft,
  ExternalLink, Sparkles, Ticket, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import StarBackground from '../components/StarBackground';
import EventCountdown from '../components/EventCountdown';
import GuestAvatarStack from '../components/GuestAvatarStack';
import ShareCardModal from '../components/ShareCardModal';

const SAMPLE_EVENT = {
  title: 'Bonfire & vinyl',
  location: 'Rooftop, 214 Elm St',
  date: new Date(Date.now() + 9 * 86400000 + 5 * 3600000).toISOString(),
  code: 'K7QX3PLM',
};
const SAMPLE_GUEST_NAMES = ['Ava', 'Marcus', 'Jules', 'Priya', 'Dev', 'Sam'];

export default function InviteDemo() {
  const [rsvp, setRsvp] = useState(null);
  const [going, setGoing] = useState(127);
  const [showShareCard, setShowShareCard] = useState(false);

  const handleRSVP = (status) => {
    if (status === 'yes' && rsvp !== 'yes') setGoing((g) => g + 1);
    if (status !== 'yes' && rsvp === 'yes') setGoing((g) => g - 1);
    setRsvp(status);
    const labels = { yes: "You're going — RSVP confirmed", maybe: 'RSVP saved as maybe', no: "RSVP saved — you're not attending" };
    toast.success(labels[status]);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#040407' }}>
      <StarBackground fixed={false} starCount={160} />

      <div className="relative z-10">
        <div className="border-b border-neutral-800/40" style={{ backdropFilter: 'blur(18px)', background: 'rgba(4,4,7,0.55)' }}>
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to PlanIt
            </a>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10">
              <Sparkles className="w-3 h-3" /> Live demo
            </span>
          </div>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="max-w-2xl mx-auto px-6 py-12"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-white mb-2">This is a real invite page</h1>
            <p className="text-neutral-500 text-sm max-w-md mx-auto">
              Every guest gets one of these — a live countdown, who else is going, a QR entry pass, and a share card built in. RSVP below, it's fully interactive.
            </p>
          </div>

          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 border-b border-neutral-800/50">
              <div className="flex items-center gap-2 mb-3">
                <Ticket className="w-5 h-5 text-neutral-400" />
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Exclusive invitation</span>
              </div>
              <h2 className="text-4xl font-black text-neutral-100 mb-2">Sam Rivera</h2>
              <p className="text-neutral-400 text-lg mb-4">You're invited to attend</p>
              <EventCountdown date={SAMPLE_EVENT.date} accent="#a3a3a3" compact />
            </div>

            <div className="px-8 py-8">
              <h3 className="text-3xl font-black text-neutral-100 mb-8">{SAMPLE_EVENT.title}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Date and time</p>
                    <p className="text-neutral-200 font-medium">
                      {new Date(SAMPLE_EVENT.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Location</p>
                    <p className="text-neutral-200 font-medium">{SAMPLE_EVENT.location}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Invitation code</p>
                    <p className="text-2xl font-mono font-black text-neutral-100 tracking-widest">{SAMPLE_EVENT.code}</p>
                  </div>
                </div>
              </div>

              <div className="mb-8 p-6 bg-neutral-800/30 rounded-2xl border border-neutral-700/50">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-400" /> RSVP
                  </h3>
                  <GuestAvatarStack names={SAMPLE_GUEST_NAMES} label={`${going} going`} />
                </div>
                <p className="text-sm text-neutral-400 mb-3">
                  {rsvp ? `Your current response: ${rsvp === 'yes' ? 'Going' : rsvp === 'maybe' ? 'Maybe' : 'Not going'} — tap another option to change it.` : 'Try it — tap a response below.'}
                </p>
                <div className="flex gap-3 flex-wrap">
                  {[
                    ['yes', 'Going', 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'],
                    ['maybe', 'Maybe', 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'],
                    ['no', "Can't make it", 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'],
                  ].map(([status, label, cls]) => (
                    <button
                      key={status}
                      onClick={() => handleRSVP(status)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${cls} ${rsvp === status ? 'ring-2 ring-white/20 scale-105' : ''}`}
                    >
                      {label}
                      {rsvp === status && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2 mb-4">
                  <QrCode className="w-5 h-5" /> Your entry pass
                </h3>
                <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                  <div className="grid grid-cols-8 gap-1" aria-hidden="true">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} className="w-3 h-3" style={{ background: (i * 7) % 5 === 0 ? '#0a0a0a' : 'transparent' }} />
                    ))}
                  </div>
                  <p className="text-sm text-neutral-600 mt-4">Sample entry pass — present this at the door</p>
                </div>
              </div>

              <button
                onClick={() => setShowShareCard(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 rounded-xl font-semibold text-neutral-200 transition-all"
              >
                <Share2 className="w-5 h-5" /> Share invite
              </button>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 text-center">
            <p className="text-white font-bold mb-1">Every one of your guests gets a page like this.</p>
            <p className="text-sm text-neutral-500 mb-4">Countdown, guest list, QR entry, and a shareable invite card — all generated automatically.</p>
            <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-200 transition-all">
              Create your event <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.main>
      </div>

      <ShareCardModal
        open={showShareCard}
        onClose={() => setShowShareCard(false)}
        eventTitle={SAMPLE_EVENT.title}
        dateLabel={new Date(SAMPLE_EVENT.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        location={SAMPLE_EVENT.location}
        guestName="Sam Rivera"
        goingCount={going}
        url="https://planitapp.onrender.com/invite/demo"
      />
    </div>
  );
}
