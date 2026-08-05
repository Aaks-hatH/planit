import { useState } from 'react';
import { CheckCircle2, ThumbsUp, ThumbsDown, Loader2, MessageSquareText } from 'lucide-react';
import { bugReportAPI } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════
// DemoFeedback — shown once a beta demo flow (Venue Walk setup/find, Face
// Ticket enroll/scan) actually completes. Submits straight into the same
// bug-report pipeline every other "Report an issue" form in the app uses
// (POST /api/bug-reports -> router -> ntfy/Discord/Slack, all configured
// via env vars on the router already — nothing new to wire up backend-side).
// ═══════════════════════════════════════════════════════════════════════════

const RATINGS = [
  { value: 'good',   label: 'Worked great',   icon: ThumbsUp,   tone: 'teal' },
  { value: 'issues', label: 'Ran into issues', icon: ThumbsDown, tone: 'rose' },
];

export default function DemoFeedback({ demoLabel, onExit }) {
  const [rating, setRating]     = useState(null);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [comments, setComments] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  async function submit(e) {
    e.preventDefault();

    if (!rating) { setError('Pick how it went first.'); return; }
    if (comments.trim().length < 5) { setError('A couple sentences helps us a lot.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('A valid email is required so we can follow up.'); return; }

    setError('');
    setLoading(true);
    try {
      await bugReportAPI.submit({
        name:        name.trim() || 'Anonymous',
        email:       email.trim(),
        category:    rating === 'issues' ? 'bug' : 'other',
        severity:    rating === 'issues' ? 'medium' : 'low',
        summary:     `Beta demo feedback \u2014 ${demoLabel}`,
        description: comments.trim(),
        eventLink:   demoLabel,
        browser:     navigator.userAgent.slice(0, 120),
      });
      setDone(true);
    } catch (err) {
      setError(
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.error ||
        'Could not submit right now. Please try again in a moment.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-5 py-14 text-center">
        <div className="w-16 h-16 rounded-full bg-teal-400/15 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-teal-300" />
        </div>
        <h2 className="font-display font-bold text-2xl mb-1.5">Thanks!</h2>
        <p className="text-neutral-500 text-sm mb-8">
          Your feedback on {demoLabel} just went straight to the team.
        </p>
        <button onClick={onExit} className="w-full py-3.5 rounded-xl bg-white text-black font-semibold text-sm">
          Back to PlanIt
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="flex items-center gap-2 text-teal-300 text-sm mb-1.5">
        <CheckCircle2 className="w-4 h-4" />
        Demo complete
      </div>
      <h2 className="font-display font-bold text-2xl mb-1.5">How did that go?</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Quick feedback on {demoLabel} &mdash; it goes straight to the team, same place bug reports go.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {RATINGS.map(({ value, label, icon: Icon, tone }) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors ${
              rating === value
                ? tone === 'teal'
                  ? 'border-teal-400/50 bg-teal-400/10 text-teal-300'
                  : 'border-rose-400/50 bg-rose-400/10 text-rose-300'
                : 'border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.06]'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1.5">
            What happened? *
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Tell us what worked, what was confusing, or what broke..."
            className="w-full bg-white/[0.03] border border-white/10 focus:border-[#8B7FFF] outline-none rounded-lg px-3 py-2.5 text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              maxLength={80}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1.5">Email *</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={120}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-400/10 border border-rose-400/20 rounded-lg px-3 py-2.5">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareText className="w-4 h-4" />}
            {loading ? 'Sending\u2026' : 'Send feedback'}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
}
