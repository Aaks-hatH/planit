import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, Users, Search, ArrowRight, Compass,
  Zap, Clock, ChevronLeft, ChevronRight, X, Sparkles, Share2, Tag
} from 'lucide-react';
import { discoverAPI } from '../services/api';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import StarBackground from '../components/StarBackground';

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function getCountdown(d) {
  const diff = new Date(d) - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs  > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
function capPct(count, max) { return max ? Math.min(100, Math.round((count / max) * 100)) : 0; }
function isSoon(d) { const diff = new Date(d) - Date.now(); return diff > 0 && diff < 172800000; }

const ACCENTS = [
  { from: 'rgba(99,102,241,0.18)', border: 'rgba(99,102,241,0.35)', chip: 'bg-indigo-950/60 border-indigo-700/40 text-indigo-300', bar: '#6366f1' },
  { from: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)',  chip: 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300', bar: '#10b981' },
  { from: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.28)', chip: 'bg-amber-950/60 border-amber-700/40 text-amber-300', bar: '#f59e0b' },
  { from: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.28)', chip: 'bg-pink-950/60 border-pink-700/40 text-pink-300', bar: '#ec4899' },
  { from: 'rgba(14,165,233,0.15)', border: 'rgba(14,165,233,0.28)', chip: 'bg-sky-950/60 border-sky-700/40 text-sky-300', bar: '#0ea5e9' },
  { from: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.28)', chip: 'bg-purple-950/60 border-purple-700/40 text-purple-300', bar: '#a855f7' },
];

function accentFor(ev, i) {
  if (ev.themeColor) return { from: `${ev.themeColor}28`, border: `${ev.themeColor}50`, chip: null, bar: ev.themeColor, hex: ev.themeColor };
  return ACCENTS[i % ACCENTS.length];
}

function Skeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      <div className="h-28 bg-neutral-800/60 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-20 bg-neutral-800 rounded-full animate-pulse" />
        <div className="h-4 w-3/4 bg-neutral-800 rounded-full animate-pulse" />
        <div className="h-3 w-full bg-neutral-800/60 rounded-full animate-pulse" />
        <div className="h-1.5 w-full bg-neutral-800 rounded-full animate-pulse mt-4" />
      </div>
    </div>
  );
}

function SharePopover({ ev, onClose }) {
  const link = ev.subdomain ? `${window.location.origin}/e/${ev.subdomain}` : `${window.location.origin}/event/${ev._id}`;
  const [copied, setCopied] = useState(false);
  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out: ${ev.title}`)}&url=${encodeURIComponent(link)}`;
  const snapchatUrl = `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(link)}`;
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div
      className="absolute bottom-full right-0 mb-2 w-60 rounded-2xl border border-neutral-700 shadow-2xl overflow-hidden z-30"
      style={{ background: '#0f0f17' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 border-b border-neutral-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-300">Share event</span>
        <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-1.5">
        <button onClick={copy} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors text-left">
          <div className="w-7 h-7 rounded-lg bg-neutral-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </div>
          <span className="text-xs font-medium text-neutral-200">{copied ? 'Copied!' : 'Copy link'}</span>
        </button>
        <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-neutral-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-neutral-300" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <span className="text-xs font-medium text-neutral-200">Share on X</span>
        </a>
        <a href={snapchatUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-yellow-950/40 border border-yellow-800/30 hover:bg-yellow-900/40 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-yellow-900/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12.166 2c.742 0 3.292.204 4.502 2.835.388.83.295 2.232.23 3.219l-.004.063-.008.147c.229-.04.48-.107.67-.197a.98.98 0 0 1 .42-.093c.208 0 .404.053.564.148.337.197.52.53.52.917 0 .515-.352.942-.95 1.154l-.186.059c-.301.086-.752.215-.87.562-.063.182-.037.382.078.576l.007.013c.547 1.08 1.655 2.295 3.545 2.622.091.016.163.082.173.17a.214.214 0 0 1-.128.214c-.357.143-1.062.258-1.936.34-.065.008-.115.057-.122.12-.017.145-.028.297-.028.455l.006.157.003.04c.01.089-.053.17-.145.184l-.23.018c-.354 0-.747-.109-1.197-.33-.542-.266-1.098-.405-1.652-.405-.225 0-.448.024-.666.073-.358.08-.69.266-.998.557-.606.573-1.245.863-1.9.863-.654 0-1.293-.29-1.9-.863-.308-.29-.64-.477-.998-.557a3.573 3.573 0 0 0-.666-.073c-.554 0-1.11.139-1.652.405-.45.221-.843.33-1.197.33l-.23-.018a.176.176 0 0 1-.145-.184l.003-.04.006-.157c0-.158-.011-.31-.028-.455-.007-.063-.057-.112-.122-.12-.874-.082-1.579-.197-1.936-.34a.214.214 0 0 1-.128-.214.183.183 0 0 1 .173-.17c1.89-.327 2.998-1.542 3.545-2.622l.007-.013c.115-.194.14-.394.078-.576-.118-.347-.569-.476-.87-.562l-.186-.059c-.598-.212-.95-.639-.95-1.154 0-.387.183-.72.52-.917.16-.095.356-.148.564-.148a.98.98 0 0 1 .42.093c.197.093.454.16.69.198l-.012-.21c-.065-.987-.158-2.388.23-3.218C8.874 2.204 11.424 2 12.166 2z"/></svg>
          </div>
          <span className="text-xs font-medium text-yellow-400">Snapchat</span>
        </a>
      </div>
    </div>
  );
}

function EventCard({ ev, index, onClick }) {
  const [showShare, setShowShare] = useState(false);
  const shareRef = useRef(null);
  const ac  = accentFor(ev, index);
  const pct = capPct(ev.participantCount, ev.maxParticipants);
  const cd  = getCountdown(ev.date);
  const full = pct >= 100;

  useEffect(() => {
    if (!showShare) return;
    const h = (e) => { if (shareRef.current && !shareRef.current.contains(e.target)) setShowShare(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showShare]);

  const chipStyle = ac.hex ? { borderColor: `${ac.hex}40`, color: ac.hex, background: `${ac.hex}15` } : {};
  const chipClass = ac.chip ? `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${ac.chip}` : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border';

  return (
    <div className="group relative flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition-all duration-300 hover:scale-[1.015] hover:border-neutral-600 hover:shadow-2xl hover:shadow-black/60">
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${ac.border}, transparent)` }} />

      {/* Cover or gradient strip */}
      <div className="relative flex-shrink-0 overflow-hidden cursor-pointer" style={{ height: ev.coverImage ? '140px' : '72px' }} onClick={onClick}>
        {ev.coverImage ? (
          <>
            <img src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(9,9,18,0.65) 100%)' }} />
          </>
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${ac.from.replace(/[\d.]+\)$/, '0.45)')}, transparent)` }} />
        )}

        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {isSoon(ev.date) && !full && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950/80 border border-amber-700/50 text-amber-300 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />Soon
            </span>
          )}
          {full && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-950/80 border border-red-700/50 text-red-300 backdrop-blur-sm">Full</span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5" ref={shareRef}>
          <button
            onClick={e => { e.stopPropagation(); setShowShare(s => !s); }}
            className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/70 transition-colors"
          ><Share2 className="w-3.5 h-3.5 text-white" /></button>
          {showShare && <SharePopover ev={ev} onClose={() => setShowShare(false)} />}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 cursor-pointer" onClick={onClick}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={chipClass} style={chipStyle}>
            <Calendar className="w-3 h-3" />{formatDate(ev.date)}
          </div>
          {cd && <span className="text-xs text-neutral-600 flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />{cd}</span>}
        </div>

        <h2 className="text-sm font-bold text-white mb-2 leading-snug line-clamp-2 group-hover:text-neutral-100 transition-colors">{ev.title}</h2>

        {ev.description
          ? <p className="text-xs text-neutral-500 mb-3 line-clamp-2 leading-relaxed flex-1">{ev.description}</p>
          : <div className="flex-1" />
        }

        {ev.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ev.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full text-xs border border-neutral-700/60 text-neutral-500 bg-neutral-800/40">{tag}</span>
            ))}
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          {ev.location && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <MapPin className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ev.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <Clock className="w-3 h-3 flex-shrink-0" /><span>{formatTime(ev.date)}</span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-neutral-700 mb-1.5">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ev.participantCount} joined</span>
            <span>{ev.maxParticipants} max</span>
          </div>
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : (ac.bar) }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 group-hover:text-white transition-colors">
          {full ? 'View event' : 'Join event'}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}

function getAllTags(events) {
  const c = {};
  events.forEach(ev => (ev.tags || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

export default function Discover() {
  const { wl, isWL } = useWhiteLabel();
  const [events,    setEvents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const [activeTag, setActiveTag] = useState(null);
  const navigate = useNavigate();
  const LIMIT = 12;

  const primary  = (isWL && wl?.branding?.primaryColor) || '#6366f1';
  const company  = (isWL && (wl?.branding?.companyName || wl?.clientName)) || 'PlanIt';
  const logo     = isWL && wl?.branding?.logoUrl;
  const headline = (isWL && wl?.pages?.events?.headline) || 'Discover Events';
  const subline  = (isWL && !wl?.branding?.hidePoweredBy)
    ? `Events hosted on ${company}`
    : isWL
    ? `Events on ${company}`
    : 'Browse public events and jump in — no invite needed.';

  useEffect(() => {
    setLoading(true);
    if (isWL) {
      // WL domain: fetch only this tenant's events
      fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')}/events/public/wl?domain=${encodeURIComponent(window.location.hostname)}&limit=${LIMIT}`)
        .then(r => r.ok ? r.json() : { events: [] })
        .then(d => { setEvents(d.events || []); setTotal(d.events?.length || 0); })
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    } else {
      discoverAPI.getPublicEvents({ page, limit: LIMIT })
        .then(r => { setEvents(r.data.events || []); setTotal(r.data.pagination?.total || 0); })
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }
  }, [page, isWL]);

  const filtered = events.filter(ev => {
    const ms = !search.trim() || [ev.title, ev.location, ev.description].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    const mt = !activeTag || (ev.tags || []).includes(activeTag);
    return ms && mt;
  });

  const allTags    = getAllTags(events);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#06060c' }}>
      <StarBackground fixed starCount={140} />

      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        .card-in { animation: fade-up 0.38s ease-out both; }
      `}</style>

      <header className="sticky top-0 z-50 border-b border-neutral-800/60" style={{ background: 'rgba(6,6,12,0.96)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer flex-shrink-0" onClick={() => navigate('/')}>
            {logo
              ? <img src={logo} alt={company} style={{ height: 30, objectFit: 'contain', maxWidth: 130 }} />
              : (
                <>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-neutral-300" />
                    </div>
                    {!isWL && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06060c] animate-pulse" />}
                  </div>
                  <span className="text-lg font-bold text-white">{company}</span>
                </>
              )
            }
          </div>

          <div className="relative flex-1 max-w-md mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-white placeholder-neutral-600 border border-neutral-800 focus:border-neutral-600 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)' }}
              placeholder="Search events, locations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!isWL && (
            <button onClick={() => navigate('/')} className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all">
              <Zap className="w-4 h-4" /><span className="hidden sm:inline">Create event</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12" style={{ zIndex: 2 }}>
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-800 text-xs font-medium text-neutral-500 mb-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Sparkles className="w-3.5 h-3.5" />{isWL ? company : "Open to everyone"}
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">{headline}</h1>
          <p className="text-lg text-neutral-500 max-w-md mx-auto">{subline}</p>
          {!loading && total > 0 && (
            <div className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full border border-neutral-800 text-sm text-neutral-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {total} event{total !== 1 ? 's' : ''} available
            </div>
          )}
        </div>

        {!loading && allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Tag className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
            {['All', ...allTags].map(tag => {
              const active = tag === 'All' ? !activeTag : activeTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag === 'All' ? null : (activeTag === tag ? null : tag))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'bg-white text-neutral-900 border-white' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300'}`}
                >{tag}</button>
              );
            })}
          </div>
        )}

        {(search || activeTag) && !loading && filtered.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-xs text-neutral-500">Showing</span>
            {search && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                "{search}" <button onClick={() => setSearch('')} className="text-neutral-500 hover:text-neutral-300 ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            {activeTag && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                {activeTag} <button onClick={() => setActiveTag(null)} className="text-neutral-500 hover:text-neutral-300 ml-0.5"><X className="w-3 h-3" /></button>
              </span>
            )}
            <span className="text-xs text-neutral-600">— {filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-center mb-5">
              <Compass className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{search || activeTag ? 'No events found' : 'Nothing here yet'}</h3>
            <p className="text-sm text-neutral-500 max-w-xs mb-6">
              {search ? `No events match "${search}".` : activeTag ? `No events tagged "${activeTag}".` : 'No public events right now. Be the first!'}
            </p>
            {(search || activeTag) ? (
              <button onClick={() => { setSearch(''); setActiveTag(null); }} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 rounded-xl hover:border-neutral-500 hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <X className="w-3.5 h-3.5" />Clear filters
              </button>
            ) : (
              <button onClick={() => navigate('/')} className="flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all">
                Create an event <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((ev, i) => (
              <div key={ev._id} className="card-in" style={{ animationDelay: `${i * 35}ms` }}>
                <EventCard ev={ev} index={i} onClick={() => navigate(ev.subdomain ? `/e/${ev.subdomain}` : `/event/${ev._id}`)} />
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && !loading && !isWL && (
          <div className="flex items-center justify-center gap-3 mt-14">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-neutral-400 border border-neutral-800 rounded-xl hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <ChevronLeft className="w-4 h-4" />Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…'); acc.push(p); return acc; }, [])
                .map((p, i) => p === '…'
                  ? <span key={`d${i}`} className="w-8 text-center text-neutral-600 text-sm">…</span>
                  : <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${page === p ? 'bg-white text-neutral-900 font-bold' : 'text-neutral-500 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700'}`}>{p}</button>
                )}
            </div>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-neutral-400 border border-neutral-800 rounded-xl hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
