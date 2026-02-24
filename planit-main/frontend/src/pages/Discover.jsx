import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, Search, ArrowRight, Compass } from 'lucide-react';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Discover() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-neutral-900 tracking-tight">PlanIt</span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              className="input pl-9 text-sm py-1.5 h-9"
              placeholder="Search events…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => navigate('/')} className="btn btn-primary text-sm px-4 py-1.5">
            Create event
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">Discover Events</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Public events open for anyone to join</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <Compass className="w-6 h-6 text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-700 mb-1">
              {search ? 'No events match your search' : 'No public events right now'}
            </p>
            <p className="text-xs text-neutral-400">
              {search ? 'Try a different term' : 'Check back soon or create your own'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-neutral-400 mb-5">{total} public event{total !== 1 ? 's' : ''} upcoming</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(ev => (
                <button
                  key={ev._id}
                  onClick={() => navigate(`/event/${ev._id}`)}
                  className="card p-5 text-left hover:shadow-md transition-all duration-150 group"
                >
                  {/* Date chip */}
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-violet-50 border border-violet-100 rounded-full mb-3">
                    <Calendar className="w-3 h-3 text-violet-500" />
                    <span className="text-xs font-medium text-violet-700">{formatDate(ev.date)}</span>
                  </div>

                  <h2 className="text-sm font-semibold text-neutral-900 mb-2 leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
                    {ev.title}
                  </h2>

                  {ev.description && (
                    <p className="text-xs text-neutral-500 mb-3 line-clamp-2 leading-relaxed">{ev.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-auto">
                    {ev.location && (
                      <span className="flex items-center gap-1 text-xs text-neutral-400 min-w-0 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />{ev.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-neutral-400 ml-auto flex-shrink-0">
                      <Users className="w-3 h-3" />
                      {ev.participantCount}/{ev.maxParticipants}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-3 text-xs font-medium text-violet-600 group-hover:gap-2 transition-all">
                    Join event <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {total > LIMIT && (
              <div className="flex justify-center gap-2 mt-8">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary text-sm px-4">Previous</button>
                <span className="flex items-center text-xs text-neutral-500 px-3">Page {page} of {Math.ceil(total / LIMIT)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / LIMIT)} className="btn btn-secondary text-sm px-4">Next</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
