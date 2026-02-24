import { useState, useEffect } from 'react';
import {
  ArrowRight, X, Link, Copy, Check, MessageSquare, BarChart3,
  Users, Calendar, CheckCircle2, Globe, Image, Palette, Share2
} from 'lucide-react';

const STEPS = [
  {
    id: 'welcome',
    title: 'Your event is live',
    subtitle: 'Share the link with your team and start planning together.',
  },
  {
    id: 'features',
    title: 'Everything in one place',
    subtitle: 'Your event comes fully loaded — no setup needed.',
  },
  {
    id: 'share',
    title: 'Spread the word',
    subtitle: 'Invite your team with a link, QR code, or social share.',
  },
  {
    id: 'discovery',
    title: 'Make it discoverable',
    subtitle: 'Public events appear on the Discover page for anyone to join.',
  },
];

const FEATURES = [
  { icon: MessageSquare, label: 'Real-time chat',     desc: 'Talk with your whole team in one thread' },
  { icon: BarChart3,     label: 'Polls & decisions',  desc: 'Vote on options and track results live'   },
  { icon: CheckCircle2, label: 'Tasks & deadlines',   desc: 'Assign work and track what is done'       },
  { icon: Users,         label: 'RSVP management',    desc: 'See who is coming and follow up'          },
  { icon: Calendar,      label: 'Agenda builder',     desc: 'Schedule the timeline minute by minute'  },
  { icon: Image,         label: 'File sharing',       desc: 'Upload docs, images, spreadsheets'       },
];

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
      <button
        onClick={handle}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          copied ? 'bg-emerald-500 text-white' : 'bg-white text-neutral-900 hover:bg-neutral-100'
        }`}
      >
        {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
      </button>
    </div>
  );
}

function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-white'
              : i < current
              ? 'w-2 h-2 bg-neutral-400'
              : 'w-2 h-2 bg-neutral-700'
          }`}
        />
      ))}
    </div>
  );
}

export default function Onboarding({ eventId, subdomain, isOrganizer, onClose }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  const link = subdomain
    ? `${window.location.origin}/e/${subdomain}`
    : `${window.location.origin}/event/${eventId}`;

  useEffect(() => {
    // Small delay for entrance animation
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleClose();
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join my event: ${link}`)}`;
  const snapchatUrl = `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(link)}`;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-md rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        style={{ background: '#0f0f17' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient top strip */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)' }} />

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-8">
          <ProgressDots total={STEPS.length} current={step} />

          {/* Step: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{STEPS[0].title}</h2>
              <p className="text-neutral-400 text-sm mb-6">{STEPS[0].subtitle}</p>
              <CopyBox link={link} />
            </div>
          )}

          {/* Step: Features */}
          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-white mb-2">{STEPS[1].title}</h2>
                <p className="text-neutral-400 text-sm">{STEPS[1].subtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FEATURES.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="p-3 rounded-2xl border border-neutral-800 bg-neutral-900/60">
                    <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center mb-2">
                      <Icon className="w-4 h-4 text-neutral-400" />
                    </div>
                    <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
                    <p className="text-xs text-neutral-500 leading-snug">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Share */}
          {step === 2 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mx-auto mb-5">
                <Share2 className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{STEPS[2].title}</h2>
              <p className="text-neutral-400 text-sm mb-6">{STEPS[2].subtitle}</p>

              <div className="space-y-3">
                <CopyBox link={link} />

                <div className="grid grid-cols-2 gap-3 mt-4">
                  {/* Twitter / X */}
                  <a
                    href={twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-700 bg-neutral-800/60 hover:bg-neutral-700/60 transition-all group"
                  >
                    <svg className="w-4 h-4 text-neutral-300 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Share on X</span>
                  </a>

                  {/* Snapchat */}
                  <a
                    href={snapchatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-yellow-800/40 bg-yellow-950/20 hover:bg-yellow-900/30 transition-all group"
                  >
                    <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.166 2c.742 0 3.292.204 4.502 2.835.388.83.295 2.232.23 3.219l-.004.063c-.003.051-.006.1-.008.147.229-.04.48-.107.67-.197a.98.98 0 0 1 .42-.093c.208 0 .404.053.564.148.337.197.52.53.52.917 0 .515-.352.942-.95 1.154-.057.02-.12.04-.186.059-.301.086-.752.215-.87.562-.063.182-.037.382.078.576l.007.013c.547 1.08 1.655 2.295 3.545 2.622.091.016.163.082.173.17a.214.214 0 0 1-.128.214c-.357.143-1.062.258-1.936.34-.065.008-.115.057-.122.12-.017.145-.028.297-.028.455 0 .053.003.105.006.157l.003.04c.01.089-.053.17-.145.184-.077.012-.153.018-.23.018-.354 0-.747-.109-1.197-.33-.542-.266-1.098-.405-1.652-.405-.225 0-.448.024-.666.073-.358.08-.69.266-.998.557-.606.573-1.245.863-1.9.863-.654 0-1.293-.29-1.9-.863-.308-.29-.64-.477-.998-.557a3.573 3.573 0 0 0-.666-.073c-.554 0-1.11.139-1.652.405-.45.221-.843.33-1.197.33a1.48 1.48 0 0 1-.23-.018.176.176 0 0 1-.145-.184l.003-.04c.003-.052.006-.104.006-.157 0-.158-.011-.31-.028-.455-.007-.063-.057-.112-.122-.12-.874-.082-1.579-.197-1.936-.34a.214.214 0 0 1-.128-.214.183.183 0 0 1 .173-.17c1.89-.327 2.998-1.542 3.545-2.622l.007-.013c.115-.194.14-.394.078-.576-.118-.347-.569-.476-.87-.562a3.16 3.16 0 0 1-.186-.059c-.598-.212-.95-.639-.95-1.154 0-.387.183-.72.52-.917.16-.095.356-.148.564-.148a.98.98 0 0 1 .42.093c.197.093.454.16.69.198l-.012-.21c-.065-.987-.158-2.388.23-3.218C8.874 2.204 11.424 2 12.166 2z"/>
                    </svg>
                    <span className="text-sm font-medium text-yellow-400">Snapchat</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Step: Discovery (organizer only) */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
                <Globe className="w-8 h-8 text-violet-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{STEPS[3].title}</h2>
              <p className="text-neutral-400 text-sm mb-6">{STEPS[3].subtitle}</p>

              <div className="text-left space-y-3 mb-6">
                {[
                  { icon: Globe,   text: 'Toggle "Public Event" in Settings → Features' },
                  { icon: Image,   text: 'Upload a cover image from Settings → Theme' },
                  { icon: Palette, text: 'Pick a theme color to match your brand' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3 p-3 bg-neutral-900/60 rounded-xl border border-neutral-800">
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                    <p className="text-sm text-neutral-300 leading-snug">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={handleClose}
              className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={next}
              className="flex items-center gap-2 px-6 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all duration-200"
            >
              {step === STEPS.length - 1 ? 'Get started' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
