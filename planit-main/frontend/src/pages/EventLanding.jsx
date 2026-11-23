/**
 * frontend/src/pages/EventLanding.jsx
 *
 * Public landing page for one event — reached from the Discover grid at
 * /discover/:key (key = subdomain or event id). It sells the event, then hands
 * the visitor to the real thing: "Join" goes to /e/:subdomain, which already
 * handles the event login / join gate. Nothing here needs an account.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Calendar, CalendarPlus, Check, Clock, FileText, Link2,
  Lock, MapPin, MessageSquare, BarChart3, Navigation, ShieldCheck, Users, Compass, ListChecks,
} from 'lucide-react';
import PublicNav from '../components/ui/PublicNav';
import PublicFooter from '../components/ui/PublicFooter';
import Reveal from '../components/ui/Reveal';
import StarBackground from '../components/StarBackground';
import { discoverAPI } from '../services/api';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const safeHex = (c) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null);

function fmt(date, tz, opts) {
  try { return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz || undefined }).format(new Date(date)); }
  catch { return new Intl.DateTimeFormat(undefined, opts).format(new Date(date)); }
}
const fmtDay  = (d, tz) => fmt(d, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = (d, tz) => fmt(d, tz, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

function useCountdown(date) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!date) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [date]);
  if (!date) return null;
  const diff = new Date(date).getTime() - now;
  if (diff <= 0) return null;
  return {
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
  };
}

const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const icsStamp  = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function downloadIcs(ev, url) {
  const start = new Date(ev.date);
  const end   = new Date(start.getTime() + 2 * 3600000);
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PlanIt//Event//EN', 'BEGIN:VEVENT',
    `UID:${ev.id}@planit`, `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(`${(ev.description || '').slice(0, 300)}\n\n${url}`)}`,
    ev.location ? `LOCATION:${icsEscape(ev.location)}` : null,
    `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(ev.subdomain || 'event').replace(/[^a-z0-9-]/gi, '')}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ─── small pieces ────────────────────────────────────────────────────────── */
function Chip({ children, tone = 'neutral', accent }) {
  const tones = {
    neutral: 'border-white/15 bg-white/[0.06] text-neutral-200',
    amber:   'border-amber-500/40 bg-amber-950/70 text-amber-300',
    red:     'border-red-500/40 bg-red-950/70 text-red-300',
    green:   'border-emerald-500/40 bg-emerald-950/70 text-emerald-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm ${tones[tone]}`}
      style={tone === 'accent' ? { borderColor: `${accent}66`, background: `${accent}22`, color: '#fff' } : undefined}>
      {children}
    </span>
  );
}

function CountTile({ value, label }) {
  return (
    <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-center">
      <div className="t-num text-2xl font-bold text-white leading-none">{String(value).padStart(2, '0')}</div>
      <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

function Section({ title, children, delay = 0 }) {
  return (
    <Reveal delay={delay} className="mt-12 first:mt-0">
      <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{title}</h2>
      {children}
    </Reveal>
  );
}

function LandingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-[46vh] min-h-[320px] bg-neutral-900" />
      <div className="mx-auto mt-10 grid max-w-6xl gap-10 px-[var(--gutter)] lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="h-4 w-1/3 rounded-full bg-neutral-800" />
          <div className="h-3 w-full rounded-full bg-neutral-800/70" />
          <div className="h-3 w-5/6 rounded-full bg-neutral-800/70" />
          <div className="h-3 w-2/3 rounded-full bg-neutral-800/70" />
        </div>
        <div className="h-72 rounded-3xl bg-neutral-900" />
      </div>
    </div>
  );
}

/* ─── page ────────────────────────────────────────────────────────────────── */
export default function EventLanding() {
  const { key } = useParams();
  const navigate = useNavigate();
  const [ev, setEv] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | missing | error
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading'); setEv(null);
    discoverAPI.getLanding(key)
      .then(r => { if (!cancelled) { setEv(r.data.event); setState('ready'); } })
      .catch(err => { if (!cancelled) setState(err.response?.status === 404 ? 'missing' : 'error'); });
    window.scrollTo(0, 0);
    return () => { cancelled = true; };
  }, [key]);

  const accent  = safeHex(ev?.themeColor) || '#2f5bff';
  const slug    = ev?.subdomain || ev?.id;
  const origin  = typeof window !== 'undefined' ? window.location.origin : '';
  const pageUrl = `${origin}/discover/${slug || key}`;
  const joinPath = !ev ? `/e/${key}`
    : ev.eventType === 'rsvpOnly' && ev.rsvpPageOpen ? `/rsvp/${slug}`
    : ev.subdomain ? `/e/${ev.subdomain}` : `/event/${ev.id}`;

  const countdown = useCountdown(ev?.status === 'active' ? ev?.date : null);
  const ended     = ev?.status === 'completed' || (ev?.date && new Date(ev.date) < new Date() && !countdown);
  const cancelled = ev?.status === 'cancelled';
  const pct       = ev?.maxParticipants ? Math.min(100, Math.round((ev.participantCount / ev.maxParticipants) * 100)) : 0;
  const spotsLeft = ev ? Math.max(0, ev.maxParticipants - ev.participantCount) : 0;
  const full      = ev ? spotsLeft === 0 : false;
  const closed    = cancelled || ended;

  const ctaLabel = cancelled ? 'Event cancelled'
    : ended ? 'Event has ended'
    : ev?.eventType === 'rsvpOnly' && ev?.rsvpPageOpen ? 'RSVP now'
    : full ? 'Open event space'
    : ev?.requireApproval ? 'Request to join'
    : 'Join event';

  /* tab title, description + search-engine structured data */
  useEffect(() => {
    if (!ev) return undefined;
    const prevTitle = document.title;
    document.title = `${ev.title} · PlanIt`;
    let meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute('content');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.setAttribute('content', (ev.description || `${ev.title} — join on PlanIt`).slice(0, 155));

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.text = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Event',
      name: ev.title, description: ev.description || undefined,
      startDate: ev.date || undefined,
      eventStatus: cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: ev.location ? { '@type': 'Place', name: ev.location } : undefined,
      image: ev.coverImage || undefined,
      organizer: { '@type': 'Person', name: ev.organizerName },
      url: pageUrl,
    });
    document.head.appendChild(ld);
    return () => { document.title = prevTitle; if (prevDesc != null) meta.setAttribute('content', prevDesc); ld.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev]);

  const features = useMemo(() => {
    if (!ev) return [];
    return [
      ev.features.chat  && { icon: MessageSquare, title: 'Live chat', body: 'Talk with organizers and other guests in real time, with @mentions.' },
      ev.features.polls && { icon: BarChart3,     title: 'Polls',     body: 'Vote on decisions and see results as they come in.' },
      ev.features.files && { icon: FileText,      title: 'Shared files', body: 'Maps, schedules and documents, all in one place.' },
      { icon: ListChecks, title: 'Agenda & updates', body: 'Always-current schedule and bulletin from the organizers.' },
    ].filter(Boolean);
  }, [ev]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: ev.title, url: pageUrl }); return; } catch { /* cancelled */ } }
    copyLink();
  };

  /* ── states ── */
  if (state === 'loading') {
    return (
      <div className="min-h-screen text-white" style={{ background: '#06060c' }}>
        <PublicNav dark /><LandingSkeleton />
      </div>
    );
  }

  if (state !== 'ready') {
    return (
      <div className="relative min-h-screen text-white" style={{ background: '#06060c' }}>
        <StarBackground fixed starCount={100} />
        <PublicNav dark />
        <main className="relative mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center" style={{ zIndex: 2, paddingTop: '7rem' }}>
          <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-neutral-800 bg-neutral-900/60"><Compass className="h-8 w-8 text-neutral-600" /></div>
          <h1 className="text-xl font-bold">{state === 'error' ? 'Couldn’t load this event' : 'This event isn’t listed publicly'}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            {state === 'error' ? 'Check your connection and try again.' : 'It may be private, finished, or the link may be wrong. If you were invited, you can still open it directly.'}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/discover" className="btn btn-secondary rounded-xl">Browse events</Link>
            {state === 'missing' && <button onClick={() => navigate(`/e/${key}`)} className="btn btn-primary rounded-xl">Open with invite link</button>}
            {state === 'error' && <button onClick={() => window.location.reload()} className="btn btn-primary rounded-xl">Retry</button>}
          </div>
        </main>
      </div>
    );
  }

  const mapsUrl = ev.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}` : null;

  const cta = (
    <button
      onClick={() => !closed && navigate(joinPath)}
      disabled={closed}
      className="group flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: closed ? '#404040' : accent, boxShadow: closed ? 'none' : `0 10px 30px -10px ${accent}` }}
    >
      {ctaLabel}{!closed && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
    </button>
  );

  return (
    <div className="relative min-h-screen text-white" style={{ background: '#06060c' }}>
      <StarBackground fixed starCount={110} />
      <PublicNav dark />

      {/* ── Hero ── */}
      <header className="relative overflow-hidden" style={{ zIndex: 2 }}>
        <div className="absolute inset-0">
          {ev.coverImage
            ? <img src={ev.coverImage} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full" style={{ background: `radial-gradient(120% 90% at 20% 0%, ${accent}66 0%, ${accent}1a 45%, transparent 75%)` }} />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(6,6,12,0.55) 0%, rgba(6,6,12,0.7) 55%, #06060c 100%)' }} />
        </div>

        <div className="relative mx-auto max-w-6xl px-[var(--gutter)] pb-12" style={{ paddingTop: 'calc(var(--safe-top, 0px) + 7.5rem)' }}>
          <Link to="/discover" className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> All events
          </Link>

          <Reveal>
            <div className="mb-4 flex flex-wrap gap-2">
              {cancelled && <Chip tone="red">Cancelled</Chip>}
              {ended && !cancelled && <Chip>Ended</Chip>}
              {!closed && full && <Chip tone="red">Full</Chip>}
              {!closed && !full && countdown && countdown.days < 2 && <Chip tone="amber"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />Starting soon</Chip>}
              {ev.isPasswordProtected && <Chip><Lock className="h-3 w-3" />Password required</Chip>}
              {ev.requireApproval && <Chip><ShieldCheck className="h-3 w-3" />Host approval</Chip>}
              {ev.tags.slice(0, 4).map(t => <Chip key={t} tone="accent" accent={accent}>{t}</Chip>)}
            </div>
            <h1 className="t-h1 max-w-[20ch] text-white" style={{ textShadow: '0 2px 30px rgba(0,0,0,0.5)' }}>{ev.title}</h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-neutral-200">
              {ev.date && <span className="flex items-center gap-2"><Calendar className="h-4 w-4" style={{ color: accent }} />{fmtDay(ev.date, ev.timezone)}</span>}
              {ev.date && <span className="flex items-center gap-2"><Clock className="h-4 w-4" style={{ color: accent }} />{fmtTime(ev.date, ev.timezone)}</span>}
              {ev.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: accent }} />{ev.location}</span>}
            </div>
          </Reveal>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="relative mx-auto max-w-6xl px-[var(--gutter)] pb-32 lg:pb-20" style={{ zIndex: 2 }}>
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          {/* left column */}
          <div className="min-w-0">
            {ev.description && (
              <Section title="About this event">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-300">{ev.description}</p>
              </Section>
            )}

            {ev.agenda.length > 0 && (
              <Section title="Agenda" delay={0.05}>
                <ol className="relative space-y-6 border-l border-white/10 pl-6">
                  {ev.agenda.map(item => (
                    <li key={item.id} className="relative">
                      <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[#06060c]" style={{ background: accent }} />
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        {item.time && <span className="t-num text-sm font-bold" style={{ color: accent }}>{item.time}</span>}
                        <span className="text-[15px] font-semibold text-white">{item.title}</span>
                        {item.duration > 0 && <span className="text-xs text-neutral-500">{item.duration} min</span>}
                      </div>
                      {item.description && <p className="mt-1 text-sm leading-relaxed text-neutral-400">{item.description}</p>}
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            <Section title="Inside the event space" delay={0.05}>
              <div className="grid gap-3 sm:grid-cols-2">
                {features.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20">
                    <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${accent}22`, color: accent }}><Icon className="h-4 w-4" /></div>
                    <p className="text-sm font-bold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{body}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-neutral-500">No account needed — you pick a name when you join.</p>
            </Section>

            <Section title="Hosted by" delay={0.05}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full text-base font-bold text-white" style={{ background: `${accent}55` }}>
                  {ev.organizerName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{ev.organizerName}</p>
                  <p className="text-xs text-neutral-500">Organizer</p>
                </div>
              </div>
            </Section>
          </div>

          {/* right column — sticky join card (desktop) */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal delay={0.1} y={12}>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c15]/90 backdrop-blur-xl" style={{ boxShadow: `0 30px 80px -40px ${accent}88` }}>
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                <div className="space-y-5 p-5">
                  {countdown && !closed && (
                    <div>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Starts in</p>
                      <div className="flex gap-2">
                        <CountTile value={countdown.days} label="days" />
                        <CountTile value={countdown.hours} label="hrs" />
                        <CountTile value={countdown.mins} label="min" />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-neutral-300"><Users className="h-3.5 w-3.5" /><span className="t-num font-bold text-white">{ev.participantCount}</span> joined</span>
                      <span className="text-neutral-500">{full ? 'No spots left' : `${spotsLeft.toLocaleString()} spot${spotsLeft === 1 ? '' : 's'} left`}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : accent }} />
                    </div>
                    {full && ev.waitlistCount > 0 && <p className="mt-2 text-[11px] text-neutral-500">{ev.waitlistCount} on the waitlist</p>}
                  </div>

                  <div className="hidden lg:block">{cta}</div>
                  <p className="hidden text-center text-[11px] text-neutral-500 lg:block">
                    {ev.isPasswordProtected ? 'You’ll need the event password on the next screen.' : ev.requireApproval ? 'The host approves new guests.' : 'Takes about 10 seconds.'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                    {ev.date && (
                      <button onClick={() => downloadIcs(ev, pageUrl)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/10">
                        <CalendarPlus className="h-3.5 w-3.5" />Add to calendar
                      </button>
                    )}
                    <button onClick={share} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/10">
                      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" />Link copied</> : <><Link2 className="h-3.5 w-3.5" />Share</>}
                    </button>
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-white/10">
                        <Navigation className="h-3.5 w-3.5" />Get directions
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          </aside>
        </div>
      </main>

      {/* ── Mobile sticky join bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a12]/95 px-4 pt-3 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{ev.title}</p>
            <p className="truncate text-xs text-neutral-500">{ev.date ? fmt(ev.date, ev.timezone, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</p>
          </div>
          <div className="w-44 flex-none">{cta}</div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
