import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Search, ArrowRight, Compass, Sparkles } from 'lucide-react';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return { day: '', month: '' };
  const d = new Date(dateStr);
  return {
    day: d.toLocaleDateString('en-GB', { day: 'numeric' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

function CapacityBar({ current, max }) {
  if (!max) return null;
  const pct = Math.min(100, Math.round((current / max) * 100));
  const color = pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-neutral-400 tabular-nums">
        {current}/{max}
      </span>
    </div>
  );
}

export default function Discover() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-[#f8f8f6]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-6">

          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 rounded-xl bg-neutral-950 flex items-center justify-center shadow-sm group-hover:bg-neutral-800 transition-colors">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-[15px] font-bold text-neutral-950 tracking-[-0.02em]">PlanIt</span>
          </div>

          {/* Search */}
          <div className={`relative flex-1 max-w-sm transition-all duration-200 ${focused ? 'max-w-md' : ''}`}>
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-150 ${focused ? 'text-neutral-700' : 'text-neutral-400'}`} />
            <input
              className="w-full h-10 pl-10 pr-4 text-sm bg-neutral-100 border border-transparent rounded-xl text-neutral-900 placeholder-neutral-400 outline-none transition-all duration-200 focus:bg-white focus:border-neutral-300 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
              placeholder="Search by name or location…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => navigate('/')}
              className="h-10 px-5 bg-neutral-950 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all duration-150 shadow-sm"
            >
              Create event
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-start gap-4 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 flex items-center justify-center shadow-[0_4px_12px_rgba(124,58,237,0.3)] shrink-0 mt-0.5">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-950 tracking-[-0.03em] leading-tight">
                Discover Events
              </h1>
              <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                Explore public events open for anyone to join — find your next experience.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-neutral-200 border-t-neutral-700 animate-spin" />
            <p className="text-xs text-neutral-400 font-medium">Loading events…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-28">
            <div className="w-16 h-16 rounded-3xl bg-white border border-neutral-200 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Compass className="w-7 h-7 text-neutral-300" />
            </div>
            <p className="text-base font-semibold text-neutral-800 mb-1.5 tracking-tight">
              {search ? 'No matching events' : 'Nothing here yet'}
            </p>
            <p className="text-sm text-neutral-400 max-w-xs">
              {search
                ? `No events found for "${search}". Try a different keyword.`
                : 'Public events will appear here. Check back soon or create your own.'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-5 text-xs font-semibold text-violet-600 hover:text-violet-700 underline underline-offset-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Count row */}
            <div className="flex items-center gap-2 mb-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 tracking-wide uppercase">
                <Sparkles className="w-3 h-3 text-violet-400" />
                {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : `${total} upcoming event${total !== 1 ? 's' : ''}`}
              </span>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ev, i) => {
                const date = formatDateShort(ev.date);
                const isFull = ev.participantCount >= ev.maxParticipants;
                const spotsLeft = ev.maxParticipants - ev.participantCount;
                const almostFull = spotsLeft <= 5 && spotsLeft > 0;

                return (
                  <button
                    key={ev._id}
                    onClick={() => navigate(`/event/${ev._id}`)}
                    className="group relative text-left bg-white rounded-2xl border border-neutral-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:border-neutral-300 active:scale-[0.99] transition-all duration-200 overflow-hidden"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* Top accent line on hover */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-violet-300 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                    <div className="p-5 flex flex-col h-full min-h-[200px]">

                      {/* Date + badge row */}
                      <div className="flex items-start justify-between gap-2 mb-4">
                        {/* Calendar block */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[8px] font-bold text-violet-500 leading-none tracking-wide uppercase">{date.month}</span>
                            <span className="text-base font-bold text-violet-700 leading-none mt-0.5">{date.day}</span>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-neutral-500 leading-none">{date.full}</p>
                            <p className="text-xs font-semibold text-neutral-700 mt-0.5">{date.time}</p>
                          </div>
                        </div>

                        {/* Status badge */}
                        {isFull ? (
                          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-500 border border-rose-100">
                            Full
                          </span>
                        ) : almostFull ? (
                          <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 animate-pulse">
                            {spotsLeft} left
                          </span>
                        ) : null}
                      </div>

                      {/* Title */}
                      <h2 className="text-[15px] font-bold text-neutral-900 leading-snug tracking-[-0.01em] mb-1.5 line-clamp-2 group-hover:text-violet-700 transition-colors duration-150">
                        {ev.title}
                      </h2>

                      {/* Description */}
                      {ev.description && (
                        <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mb-3">
                          {ev.description}
                        </p>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Footer */}
                      <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2.5">
                        {ev.location && (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400 truncate">
                            <MapPin className="w-3 h-3 shrink-0 text-neutral-300" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                          <Users className="w-3 h-3 shrink-0 text-neutral-300" />
                          <CapacityBar current={ev.participantCount} max={ev.maxParticipants} />
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-xs font-semibold text-violet-600 flex items-center gap-1 group-hover:gap-1.5 transition-all duration-150">
                            Join event
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex items-center justify-center gap-3 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-9 px-5 text-sm font-semibold rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                >
                  ← Previous
                </button>
                <span className="text-xs font-medium text-neutral-400 px-2 tabular-nums">
                  Page {page} of {Math.ceil(total / LIMIT)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / LIMIT)}
                  className="h-9 px-5 text-sm font-semibold rounded-xl border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}