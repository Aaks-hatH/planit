import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, Users, Search, ArrowRight, Compass,
  Zap, Clock, ChevronLeft, ChevronRight, X, Sparkles
} from 'lucide-react';
import api from '../services/api';
import StarBackground from '../components/StarBackground';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isUpcoming(dateStr) {
  return new Date(dateStr) > new Date();
}

function isSoon(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return diff > 0 && diff < 1000 * 60 * 60 * 48; // within 48h
}

function getCapacityPct(count, max) {
  if (!max) return 0;
  return Math.min(100, Math.round((count / max) * 100));
}

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 overflow-hidden relative">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)' }} />
      <div className="h-3 w-20 bg-neutral-800 rounded-full mb-4" />
      <div className="h-5 w-3/4 bg-neutral-800 rounded-full mb-2" />
      <div className="h-3 w-full bg-neutral-800/60 rounded-full mb-1" />
      <div className="h-3 w-2/3 bg-neutral-800/60 rounded-full mb-5" />
      <div className="flex items-center gap-3">
        <div className="h-3 w-16 bg-neutral-800 rounded-full" />
        <div className="h-3 w-12 bg-neutral-800 rounded-full ml-auto" />
      </div>
    </div>
  );
}

// Event card
function EventCard({ ev, onClick, index }) {
  const pct = getCapacityPct(ev.participantCount, ev.maxParticipants);
  const soon = isSoon(ev.date);
  const upcoming = isUpcoming(ev.date);
  const full = pct >= 100;

  // Color accent per card (deterministic from title)
  const accents = [
    { from: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', tag: 'bg-indigo-950/60 border-indigo-800/50 text-indigo-300' },
    { from: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', tag: 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300' },
    { from: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.22)', tag: 'bg-amber-950/60 border-amber-800/50 text-amber-300' },
    { from: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.22)', tag: 'bg-pink-950/60 border-pink-800/50 text-pink-300' },
    { from: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.22)', tag: 'bg-sky-950/60 border-sky-800/50 text-sky-300' },
    { from: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.22)', tag: 'bg-purple-950/60 border-purple-800/50 text-purple-300' },
  ];
  const accent = accents[index % accents.length];

  return (
    <button
      onClick={onClick}
      className="group relative text-left rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-neutral-600 hover:shadow-2xl hover:shadow-black/50 focus:outline-none focus:ring-2 focus:ring-neutral-600"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Top glow accent */}
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `linear-gradient(90deg, transparent, ${accent.border}, transparent)` }} />

      {/* Corner glow */}
      <div className="absolute top-0 left-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top left, ${accent.from}, transparent 70%)` }} />

      <div className="relative p-5 flex flex-col h-full">
        {/* Top row: date chip + status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${accent.tag}`}>
            <Calendar className="w-3 h-3" />
            {formatDate(ev.date)}
          </div>
          {soon && upcoming && !full && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-950/60 border border-amber-800/40 text-amber-400 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Soon
            </span>
          )}
          {full && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-950/60 border border-red-800/40 text-red-400 flex-shrink-0">
              Full
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-sm font-bold text-white mb-2 leading-snug line-clamp-2 group-hover:text-neutral-100 transition-colors">
          {ev.title}
        </h2>

        {/* Description */}
        {ev.description && (
          <p className="text-xs text-neutral-500 mb-4 line-clamp-2 leading-relaxed flex-1">
            {ev.description}
          </p>
        )}
        {!ev.description && <div className="flex-1" />}

        {/* Meta row */}
        <div className="space-y-2 mb-4">
          {ev.location && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <MapPin className="w-3 h-3 flex-shrink-0 text-neutral-600" />
              <span className="truncate">{ev.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="w-3 h-3 flex-shrink-0 text-neutral-600" />
            <span>{formatTime(ev.date)}</span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-neutral-600 mb-1.5">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ev.participantCount} joined</span>
            <span>{ev.maxParticipants} max</span>
          </div>
          <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: pct >= 90 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#10b981'
              }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 group-hover:text-white transition-all duration-200">
          {full ? 'View event' : 'Join event'}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
        </div>
      </div>
    </button>
  );
}

export default function Discover() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const LIMIT = 12;

  useEffect(() => {
    setLoading(true);
    api.get('/events/public', { baseURL: API_URL })
      .then(r => {
        setEvents(r.data.events || []);
        setTotal(r.data.pagination?.total || 0);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = events.filter(e =>
    !search.trim() ||
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#06060c' }}>
      <StarBackground fixed={true} starCount={160} />

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(200%); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .card-appear {
          animation: fade-up 0.4s ease-out both;
        }
      `}</style>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b border-neutral-800/60"
        style={{ background: 'rgba(6,6,12,0.96)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
            onClick={() => navigate('/')}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-300" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06060c] animate-pulse" />
            </div>
            <span className="text-lg font-bold text-white">PlanIt</span>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              ref={searchRef}
              className="w-full h-10 pl-10 pr-10 rounded-xl text-sm text-white placeholder-neutral-600 border border-neutral-800 focus:border-neutral-600 focus:outline-none transition-colors duration-200"
              style={{ background: 'rgba(255,255,255,0.04)' }}
              placeholder="Search events or locations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Create CTA */}
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all duration-200 shadow-lg"
          >
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Create event</span>
          </button>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12" style={{ zIndex: 2 }}>

        {/* Hero header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-800 text-xs font-medium text-neutral-500 mb-6"
            style={{ background: 'rgba(255,255,255,0.03)' }}>
            <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
            Open to everyone
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-4">
            Discover Events
          </h1>
          <p className="text-lg text-neutral-500 max-w-md mx-auto">
            Browse public events and jump in — no invite needed.
          </p>

          {/* Stats strip */}
          {!loading && total > 0 && (
            <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full border border-neutral-800 text-sm text-neutral-500"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {total} public event{total !== 1 ? 's' : ''} available
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl border border-neutral-800 bg-neutral-900/60 flex items-center justify-center mb-5">
              <Compass className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {search ? 'No events found' : 'Nothing here yet'}
            </h3>
            <p className="text-sm text-neutral-500 max-w-xs mb-6">
              {search
                ? `No events match "${search}". Try a different term.`
                : 'No public events right now. Be the first to create one!'}
            </p>
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-neutral-300 border border-neutral-700 rounded-xl hover:border-neutral-500 hover:text-white transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <X className="w-3.5 h-3.5" /> Clear search
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 text-sm font-bold rounded-xl hover:bg-neutral-100 hover:scale-105 transition-all duration-200"
              >
                Create an event <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Active search filter badge */}
            {search && (
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs text-neutral-500">Showing results for</span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                  "{search}"
                  <button onClick={() => setSearch('')} className="text-neutral-500 hover:text-neutral-300 transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <span className="text-xs text-neutral-600">— {filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ev, i) => (
                <div key={ev._id} className="card-appear" style={{ animationDelay: `${i * 40}ms` }}>
                  <EventCard
                    ev={ev}
                    index={i}
                    onClick={() => navigate(ev.subdomain ? `/e/${ev.subdomain}` : `/event/${ev._id}`)}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-neutral-400 border border-neutral-800 rounded-xl hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '…' ? (
                        <span key={`dots-${i}`} className="w-8 text-center text-neutral-600 text-sm">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200 ${
                            page === p
                              ? 'bg-white text-neutral-900 font-bold'
                              : 'text-neutral-500 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-neutral-400 border border-neutral-800 rounded-xl hover:border-neutral-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
