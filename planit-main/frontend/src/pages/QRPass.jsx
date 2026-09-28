import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, QrCode, ScanLine, Wallet, CalendarPlus, Copy, Trash2, CheckCircle2, XCircle,
  UserPlus, Link2, Users, ShieldCheck, CameraOff, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  SLOT_MS, randomId, newEventSecret, deriveGuestKey, makeToken, verifyToken, REASON_TEXT,
  loadEvents, saveEvents, loadWallet, saveWallet, passLink, staffLink, parseHash,
} from '../utils/qrPass';

const ACCENT = '#5EEAD4';

function useQrImage(text, size = 280) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let dead = false;
    if (!text) { setSrc(''); return undefined; }
    import('qrcode').then(({ default: QR }) =>
      QR.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: size, color: { dark: '#05050f', light: '#ffffff' } })
    ).then((u) => { if (!dead) setSrc(u); }).catch(() => {});
    return () => { dead = true; };
  }, [text, size]);
  return src;
}

const copy = (text, msg) =>
  navigator.clipboard?.writeText(text).then(() => toast.success(msg)).catch(() => toast.error('Copy failed \u2014 select and copy manually.'));

// ─── Guest: live rotating pass ─────────────────────────────────────────────
function LivePass({ pass, onClose }) {
  const [token, setToken] = useState('');
  const [left, setLeft] = useState(SLOT_MS);
  const slotRef = useRef(null);
  const qr = useQrImage(token, 300);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      const now = Date.now();
      const slot = Math.floor(now / SLOT_MS);
      setLeft(SLOT_MS - (now % SLOT_MS));
      if (slot !== slotRef.current) {
        slotRef.current = slot;
        const t = await makeToken({ eventId: pass.e, guestId: pass.g, guestKey: pass.k }, now);
        if (!dead) setToken(t);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { dead = true; clearInterval(id); lock?.release?.().catch(() => {}); };
  }, [pass]);

  const frac = left / SLOT_MS;
  return (
    <div className="max-w-sm mx-auto text-center">
      <h3 className="font-display font-bold text-2xl">{pass.gn}</h3>
      <p className="text-neutral-500 text-sm mb-5">{pass.n}</p>
      <div className="relative inline-block p-3 rounded-2xl bg-white">
        {qr ? <img src={qr} alt="Rotating check-in code" className="w-64 h-64" /> : <div className="w-64 h-64" />}
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full" style={{ width: `${frac * 100}%`, background: frac < 0.2 ? '#FB7185' : ACCENT }} />
      </div>
      <p className="font-mono text-[11px] text-neutral-500 mt-2">
        New code in {Math.ceil(left / 1000)}s &middot; screenshots stop working
      </p>
      <button onClick={onClose} className="mt-6 px-4 py-2 rounded-lg border border-white/15 text-sm text-neutral-300">Close</button>
    </div>
  );
}

function WalletTab({ wallet, setWallet, active, setActive }) {
  if (active) return <LivePass pass={active} onClose={() => setActive(null)} />;
  return (
    <div className="max-w-md mx-auto">
      <h3 className="font-display font-bold text-xl mb-1">Your passes</h3>
      <p className="text-neutral-500 text-sm mb-5">
        Open a pass link from your host to add it here. The code on screen changes every 30 seconds.
      </p>
      {wallet.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400 text-center">
          No passes yet. Ask the host for your pass link, or use &ldquo;Open as guest&rdquo; on the Host tab to try it on this device.
        </div>
      )}
      <div className="space-y-3">
        {wallet.map((p) => (
          <div key={p.e + p.g} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.gn}</div>
              <div className="text-xs text-neutral-500 truncate">{p.n}</div>
            </div>
            <button onClick={() => setActive(p)} className="px-3 py-2 rounded-lg text-sm font-bold text-[#05050f]" style={{ background: ACCENT }}>Show</button>
            <button
              aria-label="Remove pass"
              onClick={() => setWallet(wallet.filter((x) => !(x.e === p.e && x.g === p.g)))}
              className="p-2 text-neutral-500 hover:text-rose-300"
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Host ───────────────────────────────────────────────────────────────────
function HostTab({ events, setEvents, addToWallet, goWallet }) {
  const [name, setName] = useState('');
  const [openId, setOpenId] = useState(events[0]?.id || null);
  const [guestText, setGuestText] = useState('');
  const [qrFor, setQrFor] = useState(null);
  const ev = events.find((e) => e.id === openId);
  const update = (id, fn) => setEvents(events.map((e) => (e.id === id ? fn(e) : e)));

  const create = () => {
    const n = name.trim();
    if (!n) return;
    const e = { id: randomId(6), name: n, secret: newEventSecret(), guests: [], usedTokens: [], log: [], created: Date.now() };
    setEvents([e, ...events]);
    setOpenId(e.id);
    setName('');
  };

  const addGuests = () => {
    const names = guestText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!names.length || !ev) return;
    update(ev.id, (e) => ({ ...e, guests: [...e.guests, ...names.map((n) => ({ id: randomId(6), name: n.slice(0, 40), checkedInAt: null }))] }));
    setGuestText('');
  };

  const passFor = async (g) => ({ v: 1, e: ev.id, n: ev.name, g: g.id, gn: g.name, k: await deriveGuestKey(ev.secret, g.id) });
  const linkFor = async (g) => passLink(await passFor(g));
  const qrLink = qrFor;
  const qrImg = useQrImage(qrLink, 300);

  return (
    <div className="max-w-2xl mx-auto grid gap-8">
      <div>
        <h3 className="font-display font-bold text-xl mb-3">Events</h3>
        <div className="flex gap-2 mb-3">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="New event name" maxLength={60}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#5EEAD4]" />
          <button onClick={create} className="px-4 rounded-lg text-sm font-bold text-[#05050f] flex items-center gap-1.5" style={{ background: ACCENT }}>
            <CalendarPlus className="w-4 h-4" />Create
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {events.map((e) => (
            <button key={e.id} onClick={() => { setOpenId(e.id); setQrFor(null); }}
              className={`px-3 py-1.5 rounded-full text-sm border ${e.id === openId ? 'border-[#5EEAD4] text-[#5EEAD4]' : 'border-white/15 text-neutral-400'}`}>
              {e.name}
            </button>
          ))}
        </div>
      </div>

      {ev && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h4 className="font-display font-bold text-lg">{ev.name}</h4>
              <p className="font-mono text-[11px] text-neutral-500">
                {ev.guests.filter((g) => g.checkedInAt).length}/{ev.guests.length} checked in
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => copy(staffLink(ev), 'Staff scanner link copied \u2014 it contains the event secret, share only with staff.')}
                className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />Staff link
              </button>
              <button
                aria-label="Delete event"
                onClick={() => { if (window.confirm(`Delete "${ev.name}" and its passes?`)) { setEvents(events.filter((e) => e.id !== ev.id)); setOpenId(null); } }}
                className="p-2 text-neutral-500 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          <textarea value={guestText} onChange={(e) => setGuestText(e.target.value)} rows={3}
            placeholder={'Add guests, one name per line'}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#5EEAD4] mb-2" />
          <button onClick={addGuests} className="mb-5 px-3 py-2 rounded-lg border border-white/15 text-sm text-neutral-200 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" />Add guests
          </button>

          <div className="divide-y divide-white/[0.06]">
            {ev.guests.map((g) => (
              <div key={g.id} className="py-3 flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[8rem]">
                  <div className="text-sm font-medium">{g.name}</div>
                  {g.checkedInAt && <div className="text-[11px] text-teal-300 font-mono">in at {new Date(g.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                </div>
                <button onClick={async () => copy(await linkFor(g), 'Pass link copied')} className="p-2 text-neutral-400 hover:text-white" aria-label="Copy pass link"><Link2 className="w-4 h-4" /></button>
                <button onClick={async () => setQrFor(await linkFor(g))} className="p-2 text-neutral-400 hover:text-white" aria-label="Show pass link QR"><QrCode className="w-4 h-4" /></button>
                <button onClick={async () => { addToWallet(await passFor(g)); goWallet(); }} className="px-2.5 py-1.5 rounded-lg border border-white/15 text-xs text-neutral-300 flex items-center gap-1"><Eye className="w-3.5 h-3.5" />Open as guest</button>
                <button onClick={() => update(ev.id, (e) => ({ ...e, guests: e.guests.filter((x) => x.id !== g.id) }))} className="p-2 text-neutral-600 hover:text-rose-300" aria-label="Remove guest"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {ev.guests.length === 0 && <p className="text-sm text-neutral-500 py-2">No guests yet.</p>}
          </div>

          {qrLink && (
            <div className="mt-5 text-center">
              <div className="inline-block p-3 bg-white rounded-xl">{qrImg && <img src={qrImg} alt="Pass link QR" className="w-56 h-56" />}</div>
              <p className="text-xs text-neutral-500 mt-2">The guest scans this once with their phone camera to add the pass. It is not the check-in code.</p>
              <button onClick={() => setQrFor(null)} className="mt-2 text-xs text-neutral-400 underline">Hide</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scan ───────────────────────────────────────────────────────────────────
function ScanTab({ events, setEvents }) {
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [result, setResult] = useState(null);
  const [camError, setCamError] = useState(null);
  const [manual, setManual] = useState('');
  const eventsRef = useRef(events);
  const idRef = useRef(eventId);
  const busyRef = useRef(false);
  const scannerRef = useRef(null);
  eventsRef.current = events;
  idRef.current = eventId;

  const handle = useCallback(async (text) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const ev = eventsRef.current.find((e) => e.id === idRef.current);
      if (!ev) { setResult({ ok: false, text: 'Pick an event first.' }); return; }
      const r = await verifyToken(text, ev);
      if (r.ok) {
        const now = Date.now();
        setEvents(eventsRef.current.map((e) => e.id !== ev.id ? e : {
          ...e,
          usedTokens: [...(e.usedTokens || []), `${r.guest.id}.${r.slot}`].slice(-500),
          guests: e.guests.map((g) => g.id === r.guest.id ? { ...g, checkedInAt: now } : g),
        }));
        setResult({ ok: true, text: r.guest.name, sub: 'Checked in' });
      } else {
        const sub = r.reason === 'already_in' ? `at ${new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined;
        setResult({ ok: false, text: r.guest ? r.guest.name : 'Rejected', sub: `${REASON_TEXT[r.reason]}${sub ? ' ' + sub : ''}` });
      }
    } finally {
      setTimeout(() => { busyRef.current = false; }, 1800);
    }
  }, [setEvents]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (dead) return;
        const sc = new Html5Qrcode('qrpass-reader');
        scannerRef.current = sc;
        const cfg = { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } };
        try { await sc.start({ facingMode: 'environment' }, cfg, handle, () => {}); }
        catch { await sc.start({ facingMode: 'user' }, cfg, handle, () => {}); }
      } catch (err) {
        if (!dead) setCamError(err?.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Camera unavailable \u2014 paste a code below to test.');
      }
    })();
    return () => {
      dead = true;
      const sc = scannerRef.current;
      scannerRef.current = null;
      if (sc) { try { sc.stop().catch(() => {}); } catch { /* not running */ } }
    };
  }, [handle]);

  return (
    <div className="max-w-md mx-auto">
      <h3 className="font-display font-bold text-xl mb-3">Scan guests in</h3>
      <select value={eventId} onChange={(e) => setEventId(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm mb-4">
        {events.length === 0 && <option value="">No events on this device</option>}
        {events.map((e) => <option key={e.id} value={e.id} className="text-black">{e.name}</option>)}
      </select>

      <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-square mb-4">
        {camError
          ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-sm text-neutral-300"><CameraOff className="w-9 h-9 text-rose-400 mb-3" />{camError}</div>
          : <div id="qrpass-reader" className="w-full h-full" />}
        {result && (
          <div className={`absolute inset-x-3 bottom-3 rounded-xl p-3.5 flex items-start gap-3 backdrop-blur ${result.ok ? 'bg-teal-500/90 text-[#05050f]' : 'bg-rose-500/90 text-white'}`}>
            {result.ok ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <XCircle className="w-6 h-6 shrink-0" />}
            <div className="text-left">
              <div className="font-bold leading-tight">{result.text}</div>
              {result.sub && <div className="text-sm opacity-90">{result.sub}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or paste a PQ1… code"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono outline-none" />
        <button onClick={() => { handle(manual); setManual(''); }} className="px-4 rounded-lg border border-white/15 text-sm text-neutral-200">Check</button>
      </div>
      <p className="text-[11px] text-neutral-500 mt-4 leading-relaxed">
        Check-in state lives on this device only. If several staff phones scan, each keeps its own list, so use one scanning phone per entrance and compare counts at the end.
      </p>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function QRPass() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('host');
  const [events, setEventsState] = useState(loadEvents);
  const [wallet, setWalletState] = useState(loadWallet);
  const [active, setActive] = useState(null);

  const setEvents = useCallback((v) => { setEventsState(v); saveEvents(v); }, []);
  const setWallet = useCallback((v) => { setWalletState(v); saveWallet(v); }, []);
  const addToWallet = useCallback((pass) => {
    setWalletState((w) => { const n = [...w.filter((x) => !(x.e === pass.e && x.g === pass.g)), pass]; saveWallet(n); return n; });
  }, []);

  // Import from a #pass= / #staff= link (fragment never leaves the browser).
  useEffect(() => {
    const parsed = parseHash(window.location.hash);
    if (!parsed) return;
    if (parsed.kind === 'pass' && parsed.data?.k) {
      addToWallet(parsed.data);
      setActive(parsed.data);
      setTab('wallet');
      toast.success('Pass added to your wallet');
    } else if (parsed.kind === 'staff' && parsed.data?.secret) {
      const d = parsed.data;
      setEventsState((list) => {
        if (list.some((e) => e.id === d.id)) return list;
        const n = [{ id: d.id, name: d.name, secret: d.secret, usedTokens: [], log: [], guests: d.guests.map((g) => ({ ...g, checkedInAt: null })), created: Date.now() }, ...list];
        saveEvents(n);
        return n;
      });
      setTab('scan');
      toast.success('Event loaded for scanning');
    }
    history.replaceState(null, '', window.location.pathname);
  }, [addToWallet]);

  const tabs = [
    { id: 'host', label: 'Host', icon: Users },
    { id: 'wallet', label: 'My pass', icon: Wallet },
    { id: 'scan', label: 'Scan', icon: ScanLine },
  ];

  return (
    <div className="min-h-screen bg-[#05050f] text-white" style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm -ml-2 px-2 py-1.5 rounded-lg">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm">
          <QrCode className="w-4 h-4" style={{ color: ACCENT }} />QR Pass
        </div>
        <div className="w-16" />
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-8">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight mb-2">A ticket that expires<br />while you watch.</h1>
        <p className="text-neutral-400 text-sm max-w-md mb-6">
          Each guest&rsquo;s code is signed on their phone and changes every 30 seconds, so a forwarded screenshot is useless. Everything runs in your browser &mdash; no server, no account.
        </p>
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold ${tab === id ? 'bg-white text-black' : 'text-neutral-400'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-16">
        {tab === 'host' && <HostTab events={events} setEvents={setEvents} addToWallet={addToWallet} goWallet={() => setTab('wallet')} />}
        {tab === 'wallet' && <WalletTab wallet={wallet} setWallet={setWallet} active={active} setActive={setActive} />}
        {tab === 'scan' && <ScanTab events={events} setEvents={setEvents} />}
      </div>
    </div>
  );
}
