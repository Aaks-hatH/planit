/**
 * LiveWaitBoard.jsx — Public Live Wait Time Display
 *
 * A public-facing, no-auth page for restaurants using walk-in / waitlist mode.
 * Accessible at: /e/:subdomain/wait
 *
 * Features:
 *  - Live estimated wait times by party size
 *  - Walk-ins can join the digital waitlist (name + phone + party size)
 *  - After joining: shows queue position + live tracker URL to bookmark
 *  - Auto-refreshes every 20s
 *  - Fully branded using reservationPageSettings (logo, accent, colors)
 *  - Reservation system can be disabled from TableService settings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, Users, CheckCircle, AlertCircle, RefreshCw,
  Phone, ChevronRight, Loader2, Star, ArrowLeft,
  UtensilsCrossed, Timer, TrendingUp, Hash, Wifi,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

function fmtWait(mins) {
  if (mins === null || mins === undefined) return '—';
  if (mins === 0) return 'Now';
  if (mins < 60) return `~${mins} min`;
  return `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function WaitBadge({ mins, accent }) {
  if (mins === null || mins === undefined) {
    return <span className="text-neutral-500 font-semibold text-lg">N/A</span>;
  }
  const color = mins === 0 ? '#22c55e' : mins <= 20 ? '#f59e0b' : '#ef4444';
  return (
    <span className="text-2xl font-black" style={{ color }}>
      {fmtWait(mins)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LiveWaitBoard() {
  const { subdomain, eventId } = useParams();
  const navigate = useNavigate();
  const id = subdomain || eventId;

  const [venue, setVenue] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Join waitlist form
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinForm, setJoinForm] = useState({ name: '', phone: '', partySize: 2 });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [myEntry, setMyEntry] = useState(null); // after joining

  const intervalRef = useRef(null);
  const accent = venue?.accentColor || '#f97316';

  // ── Load venue info (one-time) ──────────────────────────────────────────────
  const loadVenue = useCallback(async () => {
    try {
      const data = await apiFetch(`/events/public/wait/${id}/info`);
      setVenue(data);
    } catch (err) {
      setError(err.message || 'Venue not found');
    }
  }, [id]);

  // ── Load live data (polls) ──────────────────────────────────────────────────
  const loadLive = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      const data = await apiFetch(`/events/public/wait/${id}/live?tz=${tz}`);
      setLiveData(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      if (!quiet) setError(err.message || 'Could not load wait data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadVenue();
    loadLive();
    intervalRef.current = setInterval(() => loadLive(true), 20000);
    return () => clearInterval(intervalRef.current);
  }, [loadVenue, loadLive]);

  // Also refresh myEntry position if we've joined
  useEffect(() => {
    if (!myEntry || !liveData) return;
    const found = liveData.waitlist?.find(w => w.id === myEntry.id);
    if (found) setMyEntry(prev => ({ ...prev, ...found, position: liveData.waitlist.indexOf(found) + 1 }));
  }, [liveData, myEntry?.id]);

  // ── Join waitlist ───────────────────────────────────────────────────────────
  const handleJoin = async () => {
    setJoinError('');
    if (!joinForm.name.trim()) { setJoinError('Please enter your name'); return; }
    if (joinForm.partySize < 1) { setJoinError('Party size must be at least 1'); return; }
    setJoining(true);
    try {
      const data = await apiFetch(`/events/public/wait/${id}/join`, {
        method: 'POST',
        body: JSON.stringify({
          partyName: joinForm.name.trim(),
          phone: joinForm.phone.trim(),
          partySize: joinForm.partySize,
        }),
      });
      const position = (liveData?.waitlist?.length || 0) + 1;
      setMyEntry({ ...data.entry, position });
      setShowJoinForm(false);
      loadLive(true);
    } catch (err) {
      setJoinError(err.message || 'Failed to join waitlist');
    } finally {
      setJoining(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading && !liveData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: '#1a1a1a', border: '1px solid #333' }}>
            <UtensilsCrossed className="w-6 h-6 text-neutral-400" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  if (error && !liveData) {
    const isDisabled = error === 'Wait board not active';
    const isNotFound = error === 'Not found';
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="text-center p-8 max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            <UtensilsCrossed className="w-8 h-8 text-neutral-600" />
          </div>
          {isDisabled ? (
            <>
              <p className="text-white font-bold text-lg mb-2">Wait board not active</p>
              <p className="text-neutral-500 text-sm leading-relaxed">The live wait board isn't enabled for this venue right now. Check back later or ask staff for your wait time.</p>
            </>
          ) : isNotFound ? (
            <>
              <p className="text-white font-bold text-lg mb-2">Venue not found</p>
              <p className="text-neutral-500 text-sm leading-relaxed">This wait board link doesn't match an active venue. Double-check the URL or ask staff for assistance.</p>
            </>
          ) : (
            <>
              <p className="text-white font-bold text-lg mb-2">Couldn't load wait board</p>
              <p className="text-neutral-500 text-sm leading-relaxed mb-4">{error}</p>
              <button onClick={() => { setError(null); setLoading(true); loadVenue(); loadLive(); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#222', border: '1px solid #333' }}>
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const waitlist = liveData?.waitlist || [];
  const waitTimes = liveData?.waitTimes || {};
  const tableStats = liveData?.tableStats || {};
  const isOpen = liveData?.isOpen;
  const name = venue?.name || liveData?.name || 'Restaurant';
  const logoUrl = venue?.logoUrl || liveData?.logoUrl;
  const tagline = venue?.tagline || liveData?.tagline || '';
  const waitBoardMessage = venue?.waitBoardMessage || liveData?.waitBoardMessage || '';
  const waitBoardTitle = venue?.waitBoardTitle || liveData?.waitBoardTitle || '';
  const displayName = waitBoardTitle || name;
  const menus = liveData?.menus || [];

  // ── My position card (shown after joining) ──────────────────────────────────
  if (myEntry) {
    const pos = waitlist.findIndex(w => w.id === myEntry.id);
    const myPos = pos >= 0 ? pos + 1 : myEntry.position || '?';
    const myWait = waitTimes[`for${myEntry.partySize > 4 ? 'Eight' : myEntry.partySize > 2 ? 'Four' : 'Two'}`];
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
        {/* Header */}
        <header className="px-6 pt-8 pb-4 text-center">
          {logoUrl && (
            <img src={logoUrl} alt={name} className="h-10 w-auto mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-white font-black text-2xl">{displayName}</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-6 max-w-md mx-auto w-full">
          {/* Status card */}
          <div className="w-full rounded-3xl p-6 border" style={{
            background: `${accent}12`, borderColor: `${accent}40`,
          }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}25` }}>
                <CheckCircle className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>You're on the list</p>
                <p className="text-white font-black text-lg">{myEntry.partyName}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-xs text-neutral-500 font-semibold mb-1">Position</p>
                <p className="text-2xl font-black text-white">#{myPos}</p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-xs text-neutral-500 font-semibold mb-1">Party</p>
                <p className="text-2xl font-black text-white">{myEntry.partySize}</p>
              </div>
              <div className="rounded-2xl p-3 text-center" style={{ background: '#111', border: '1px solid #222' }}>
                <p className="text-xs text-neutral-500 font-semibold mb-1">Est. Wait</p>
                <WaitBadge mins={myWait} accent={accent} />
              </div>
            </div>

            {myEntry.status === 'notified' && (
              <div className="mt-4 rounded-2xl p-4 text-center animate-pulse"
                style={{ background: `${accent}20`, border: `1px solid ${accent}` }}>
                <p className="font-black text-white text-base">Your table is ready!</p>
                <p className="text-sm mt-1" style={{ color: accent }}>Please check in with the host</p>
              </div>
            )}
          </div>

          {/* Live update indicator */}
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
            <span>Live updates every 20 seconds</span>
          </div>

          {/* Waitlist count */}
          {waitlist.length > 1 && (
            <p className="text-neutral-600 text-sm text-center">
              {waitlist.length - 1} {waitlist.length - 1 === 1 ? 'party' : 'parties'} ahead of you
            </p>
          )}

          <button
            onClick={() => { setMyEntry(null); setShowJoinForm(false); }}
            className="text-neutral-600 hover:text-neutral-400 text-sm transition-colors"
          >
            Back to wait board
          </button>
        </div>
      </div>
    );
  }

  // ── Main board ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse 80% 40% at 50% -10%, ${accent}18 0%, transparent 60%)`,
      }} />

      {/* Header */}
      <header className="relative px-6 pt-10 pb-6 text-center">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-12 w-auto mx-auto mb-3 object-contain" />
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}>
            <UtensilsCrossed className="w-7 h-7" style={{ color: accent }} />
          </div>
        )}
        <h1 className="text-white font-black text-3xl tracking-tight">{displayName}</h1>
        {tagline && <p className="text-neutral-500 text-sm mt-1">{tagline}</p>}
        {waitBoardMessage && (
          <p className="mt-3 text-neutral-300 text-sm max-w-sm mx-auto leading-relaxed">{waitBoardMessage}</p>
        )}

        {/* Live dot */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {isOpen === false ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 border border-neutral-700 text-neutral-500">
              Closed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
              style={{ background: '#05231260', borderColor: '#22c55e40', color: '#22c55e' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              Live
            </span>
          )}
          {refreshing && <RefreshCw className="w-3 h-3 animate-spin text-neutral-600" />}
          {lastUpdated && (
            <span className="text-xs text-neutral-700">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="relative flex-1 px-4 pb-8 max-w-md mx-auto w-full space-y-4">

        {/* Wait times by party size */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600 mb-3 px-1">
            Current Wait Times
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '1–2 guests', key: 'forTwo', size: 2 },
              { label: '3–4 guests', key: 'forFour', size: 4 },
              { label: '5+ guests',  key: 'forEight', size: 8 },
            ].map(({ label, key, size }) => {
              const mins = waitTimes[key];
              const isAvail = mins === 0;
              return (
                <div key={key} className="rounded-2xl p-4 text-center border"
                  style={{
                    background: isAvail ? `${accent}10` : '#111',
                    borderColor: isAvail ? `${accent}50` : '#222',
                  }}>
                  <div className="flex items-center justify-center mb-1">
                    <Users className="w-3.5 h-3.5 text-neutral-600 mr-1" />
                    <span className="text-xs text-neutral-600">{label}</span>
                  </div>
                  <WaitBadge mins={mins} accent={accent} />
                  {isAvail && (
                    <p className="text-xs font-bold mt-1" style={{ color: accent }}>Available!</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Table availability summary */}
        {tableStats.total > 0 && (
          <section className="rounded-2xl border p-4" style={{ background: '#111', borderColor: '#222' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-400">Floor Status</span>
              </div>
              <span className="text-xs text-neutral-600">{tableStats.total} tables total</span>
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm text-neutral-300 font-semibold">{tableStats.available}</span>
                <span className="text-xs text-neutral-600">free</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-sm text-neutral-300 font-semibold">{tableStats.occupied}</span>
                <span className="text-xs text-neutral-600">occupied</span>
              </div>
              {tableStats.reserved > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-sm text-neutral-300 font-semibold">{tableStats.reserved}</span>
                  <span className="text-xs text-neutral-600">reserved</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Waitlist queue */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600">
              Waitlist Queue
            </h2>
            {waitlist.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black"
                style={{ background: `${accent}20`, color: accent }}>
                {waitlist.length} {waitlist.length === 1 ? 'party' : 'parties'}
              </span>
            )}
          </div>

          {waitlist.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 p-6 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-white font-bold">No wait right now</p>
              <p className="text-neutral-600 text-sm mt-1">Walk right in!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {waitlist.map((party, idx) => (
                <div key={party.id} className="rounded-2xl border p-4 flex items-center gap-3"
                  style={{ background: '#111', borderColor: party.status === 'notified' ? `${accent}40` : '#222' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                    style={{ background: party.status === 'notified' ? `${accent}25` : '#1a1a1a', color: party.status === 'notified' ? accent : '#666' }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{party.partyName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Users className="w-3 h-3 text-neutral-600 flex-shrink-0" />
                      <span className="text-xs text-neutral-500">{party.partySize} guests</span>
                      {party.addedAt && (
                        <>
                          <span className="text-neutral-700">·</span>
                          <Clock className="w-3 h-3 text-neutral-700 flex-shrink-0" />
                          <span className="text-xs text-neutral-700">
                            {Math.round((Date.now() - new Date(party.addedAt)) / 60000)}m ago
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {party.status === 'notified' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 animate-pulse"
                      style={{ background: `${accent}20`, color: accent }}>
                      Ready
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Menus */}
        {menus.length > 0 && !showJoinForm && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-600 mb-3 px-1">Our Menus</h2>
            <div className="space-y-2">
              {menus.map((menu, i) => {
                const menuAccent = menu.clr || accent;
                return (
                  <div key={i} className="rounded-2xl border flex items-center gap-3 px-4 py-3.5 transition-all"
                    style={{ background: '#111', borderColor: '#222' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: menuAccent + '20', border: `1px solid ${menuAccent}40` }}>
                      {menu.t === 'p'
                        ? <svg className="w-4 h-4" fill="none" stroke={menuAccent} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                        : <svg className="w-4 h-4" fill="none" stroke={menuAccent} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{menu.n}</p>
                      {menu.c && <p className="text-xs font-bold mt-0.5" style={{ color: menuAccent }}>{menu.c}</p>}
                      {menu.d && menu.t === 'd' && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{menu.d}</p>}
                    </div>
                    {(menu.t === 'l' || menu.t === 'p') && menu.u && (
                      <a href={menu.u} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                        style={{ background: menuAccent, color: '#000' }}>
                        {menu.t === 'p' ? 'PDF' : 'View'}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Join CTA / Form */}
        {!showJoinForm && (
          <>
            {isOpen === false && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-900/10 px-4 py-2.5 text-xs text-amber-400 text-center">
                Outside posted hours — the waitlist is still accepting entries
              </div>
            )}
            <button
              onClick={() => setShowJoinForm(true)}
              className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ background: accent, color: '#000' }}
            >
              <Users className="w-5 h-5" />
              Join the Waitlist
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {showJoinForm && (
          <div className="rounded-3xl border p-5 space-y-4" style={{ background: '#111', borderColor: '#2a2a2a' }}>
            <h3 className="text-white font-black text-lg">Join Waitlist</h3>

            {joinError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
                {joinError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                  Name / Party Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Smith party"
                  value={joinForm.name}
                  onChange={e => setJoinForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                  Phone (optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
                  <input
                    type="tel"
                    placeholder="For table-ready notifications"
                    value={joinForm.phone}
                    onChange={e => setJoinForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-600 text-sm focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                  Party Size *
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <button
                      key={n}
                      onClick={() => setJoinForm(f => ({ ...f, partySize: n }))}
                      className="w-10 h-10 rounded-xl font-bold text-sm transition-all"
                      style={{
                        background: joinForm.partySize === n ? accent : '#1a1a1a',
                        color: joinForm.partySize === n ? '#000' : '#666',
                        border: `1px solid ${joinForm.partySize === n ? accent : '#333'}`,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                  {/* 9+ option */}
                  <button
                    onClick={() => setJoinForm(f => ({ ...f, partySize: 9 }))}
                    className="px-3 h-10 rounded-xl font-bold text-sm transition-all"
                    style={{
                      background: joinForm.partySize >= 9 ? accent : '#1a1a1a',
                      color: joinForm.partySize >= 9 ? '#000' : '#666',
                      border: `1px solid ${joinForm.partySize >= 9 ? accent : '#333'}`,
                    }}
                  >
                    9+
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowJoinForm(false); setJoinError(''); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                style={{ background: accent, color: '#000' }}
              >
                {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Me'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4">
          {lastUpdated && (
            <p className="text-xs text-neutral-700">
              Auto-refreshes every 20s · Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          {venue?.showPoweredBy !== false && (
            <p className="text-xs text-neutral-800 mt-2">Powered by PlanIt</p>
          )}
        </div>
      </main>
    </div>
  );
}
