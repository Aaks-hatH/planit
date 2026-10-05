import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Check, CheckCircle2, ChevronDown, Clock, Coins, Copy,
  ExternalLink, EyeOff, Fingerprint, Globe, Heart, KeyRound, Landmark, LifeBuoy, Loader2, Lock,
  Monitor, Printer, Receipt, RefreshCw, ShieldAlert, ShieldCheck, Smartphone, Sparkles, Wallet,
  XCircle, Zap, Layers,
} from 'lucide-react';
import QRCode from 'qrcode';
import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * PlanIt Payments — Bitcoin pay page (/pay/:id)
 *
 * The invoice id in the URL is a 128-bit random value and is the only
 * credential needed to view the page. The browser never sends an amount or an
 * address anywhere; it only displays what the server issued, and runs a few
 * integrity checks on that data before it lets anyone pay (see `useIntegrity`).
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
const SUPPORT_EMAIL = 'planit.userhelp@gmail.com';

/* ── What is being bought ─────────────────────────────────────────────────── */
const PURPOSE = {
  support:          { title: 'Support PlanIt',         sub: 'One-time donation',            icon: Heart },
  feature_request:  { title: 'Feature request',        sub: 'Funds your requested feature', icon: Sparkles },
  wl_setup:         { title: 'White Label setup fee',  sub: 'One-time, before we begin',    icon: Layers },
  wl_subscription:  { title: 'White Label subscription', sub: '30 days of service',         icon: Globe },
};

const successUrl = (inv) => {
  if (inv.purpose === 'support')         return `/support/success?invoice=${inv.id}`;
  if (inv.purpose === 'feature_request') return `/support/success?invoice=${inv.id}&type=feature`;
  if (inv.purpose === 'wl_setup')        return `/white-label/setup-success?invoice=${inv.id}`;
  return null; // subscription: stay here and show the receipt
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const chunk = (addr) => addr.match(/.{1,4}/g) || [addr];
const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const explorerBase = (network) => `https://mempool.space/${network === 'mainnet' ? '' : `${network}/`}`;
const txLink = (inv) => (inv?.txid ? `${explorerBase(inv.network)}tx/${inv.txid}` : null);
const btcToSats = (s) => Number(String(s).replace('.', ''));
const fmtSats = (n) => Number(n).toLocaleString();
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const BECH32 = '[023456789acdefghjklmnpqrstuvwxyz]';
const ADDR_RE = { mainnet: new RegExp(`^bc1q${BECH32}{38}$`), test: new RegExp(`^tb1q${BECH32}{38}$`) };

/**
 * Client-side integrity checks. They run in the visitor's browser on the data
 * the server sent, and they fail CLOSED: if anything is inconsistent the pay
 * controls are hidden. This catches a corrupted or tampered response; it does
 * not replace checking the address in your own wallet (which the page also asks for).
 */
function useIntegrity(inv, amountBtc) {
  return useMemo(() => {
    if (!inv) return { ok: true, checks: [] };
    const re = inv.network === 'mainnet' ? ADDR_RE.mainnet : ADDR_RE.test;
    const addrOk = re.test(inv.address || '');

    let uriOk = false;
    try {
      const m = String(inv.uri || '').match(/^bitcoin:([a-z0-9]+)\?(.*)$/i);
      if (m) {
        const q = new URLSearchParams(m[2]);
        uriOk = m[1] === inv.address && q.get('amount') === amountBtc;
      }
    } catch { uriOk = false; }

    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const secure = typeof window !== 'undefined'
      && (window.isSecureContext || window.location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1');

    const checks = [
      { id: 'addr', ok: addrOk, label: `Address is a valid ${inv.network === 'mainnet' ? 'Bitcoin' : 'test-network'} SegWit address`, bad: 'The address format is wrong for this network.' },
      { id: 'uri',  ok: uriOk,  label: 'QR code and wallet link match the address and amount shown', bad: 'The QR / wallet link does not match the details on screen.' },
      { id: 'tls',  ok: secure, label: `Connection to ${host || 'this site'} is encrypted (HTTPS)`, bad: 'This page is not on a secure (HTTPS) connection.' },
    ];
    return { ok: checks.every((c) => c.ok), checks };
  }, [inv, amountBtc]);
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Pay() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [qr, setQr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState('btc'); // 'btc' | 'sats'
  const redirected = useRef(false);

  useEffect(() => {
    document.title = inv ? `Pay $${inv.usd.toFixed(2)} with Bitcoin — PlanIt` : 'Pay with Bitcoin — PlanIt';
  }, [inv]);

  // ── Load + live updates (socket for speed, polling as the safety net) ──────
  const load = useCallback(async () => {
    try {
      const r = await api.get(`/payments/${id}`);
      setInv(r.data);
      setError('');
      setOffline(false);
    } catch (e) {
      if (e?.response?.status === 404) setError('This payment link is not valid or has been removed.');
      else setOffline(true);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let sock;
    try {
      sock = io(`${WS_URL}/pay`, { transports: ['polling', 'websocket'], reconnectionDelayMax: 15000 });
      sock.on('connect', () => sock.emit('invoice:join', id));
      sock.on('invoice:update', (v) => { if (v?.id === id) { setInv(v); setOffline(false); } });
    } catch { /* polling still works */ }
    return () => { try { sock?.disconnect(); } catch { /* noop */ } };
  }, [id]);

  const active = inv && ['pending', 'detected'].includes(inv.status);
  useEffect(() => {
    const t = setInterval(load, active ? 5000 : 20000);
    return () => clearInterval(t);
  }, [load, active]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const amountBtc = inv ? (inv.partial ? inv.remainingBtc : inv.btc) : '';
  const amountSats = inv ? (inv.partial ? btcToSats(inv.remainingBtc) : inv.sats) : 0;
  const integrity = useIntegrity(inv, amountBtc);

  // ── QR code (generated locally — the address never leaves the browser) ────
  useEffect(() => {
    if (!inv?.uri || !integrity.ok) { setQr(''); return; }
    QRCode.toDataURL(inv.uri, { margin: 2, width: 300, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(''));
  }, [inv?.uri, integrity.ok]);

  // ── Redirect on success ───────────────────────────────────────────────────
  useEffect(() => {
    if (inv?.status === 'confirmed' && !redirected.current) {
      const to = successUrl(inv);
      if (to) { redirected.current = true; const t = setTimeout(() => navigate(to), 4500); return () => clearTimeout(t); }
    }
  }, [inv, navigate]);

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1600); } catch { /* ignore */ }
  };

  const refresh = async () => {
    setBusy(true);
    try { const r = await api.post(`/payments/${id}/refresh`); setInv(r.data); setOffline(false); } catch { /* ignore */ }
    setBusy(false);
  };

  const requote = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/payments/${id}/requote`);
      redirected.current = false;
      const qs = search.toString();
      navigate(`/pay/${r.data.id}${qs ? `?${qs}` : ''}`, { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not create a new quote. Please try again.');
    }
    setBusy(false);
  };

  /* ── Early states ── */
  if (error && !inv) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Payment link not found</h1>
          <p className="text-sm text-neutral-400 mb-6">{error}</p>
          <Link to="/support" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200">
            Back to PlanIt <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </Shell>
    );
  }
  if (!inv) {
    return (
      <Shell>
        <div className="py-32 text-center text-neutral-400 text-sm">
          <Loader2 className="w-7 h-7 animate-spin mx-auto mb-4 text-amber-400" />
          Securing your payment…
          {offline && <p className="mt-3 text-xs text-amber-300">Having trouble reaching PlanIt — retrying…</p>}
        </div>
      </Shell>
    );
  }

  const remainingMs = new Date(inv.expiresAt).getTime() - now;
  const totalMs = Math.max(60_000, new Date(inv.expiresAt).getTime() - new Date(inv.createdAt || inv.expiresAt).getTime() || 20 * 60_000);
  const testnet = inv.network !== 'mainnet';
  const meta = PURPOSE[inv.purpose] || { title: 'PlanIt payment', sub: '', icon: Coins };
  const ctx = { inv, meta, amountBtc, amountSats, unit, setUnit, copy, copied, remainingMs, totalMs, busy, refresh, requote, qr, integrity, error };

  return (
    <Shell testnet={testnet} network={inv.network} offline={offline}>
      <PaymentMasthead inv={inv} meta={meta} active={active} />
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 items-start">
        <main className="min-w-0">
          {active && <ActiveCard {...ctx} />}
          {inv.status === 'confirmed' && <ConfirmedCard {...ctx} next={successUrl(inv)} />}
          {inv.status === 'expired' && <ExpiredCard {...ctx} />}
          {inv.status === 'review' && <ReviewCard {...ctx} />}
          {inv.status === 'rejected' && <RejectedCard {...ctx} />}
        </main>

        <aside className="space-y-6 min-w-0 print:hidden">
          <OrderSummary {...ctx} />
          {active && <HowToPay />}
          <SecurityPanel integrity={integrity} />
        </aside>
      </div>

      <div className="mt-8 print:hidden"><Faq /></div>

      <p className="mt-8 text-center text-[11px] text-neutral-500 print:hidden">
        Need a hand? <Link to="/help#btc-how-to-pay" className="text-amber-300 hover:text-amber-200 underline underline-offset-2">Read the payment guide</Link>
        {' '}or email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-amber-300 hover:text-amber-200 underline underline-offset-2">{SUPPORT_EMAIL}</a>
        {' '}and include your invoice ID <span className="font-mono text-neutral-300">{inv.id.slice(0, 8)}</span>.
      </p>
    </Shell>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────────────── */
function Shell({ children, testnet, network, offline }) {
  return (
    <div className="pay-root min-h-screen relative overflow-x-hidden bg-[#070b12] text-neutral-100 font-sans">
      <style>{`
        @keyframes pay-pulse { 0%,100% { opacity: .35; transform: scale(1);} 50% { opacity: 1; transform: scale(1.35);} }
        @keyframes pay-sweep { 0% { transform: translateX(-100%);} 100% { transform: translateX(300%);} }
        @keyframes pay-pop { 0% { transform: scale(.6); opacity: 0;} 70% { transform: scale(1.08);} 100% { transform: scale(1); opacity: 1;} }
        @keyframes pay-draw { to { stroke-dashoffset: 0; } }
        .pay-pop { animation: pay-pop .5s cubic-bezier(.2,.9,.3,1.2) both; }
        .pay-draw { stroke-dasharray: 40; stroke-dashoffset: 40; animation: pay-draw .5s .25s ease-out forwards; }
        .pay-root { background-image: radial-gradient(circle at 12% -10%, rgba(56,189,248,.10), transparent 32%), radial-gradient(circle at 95% 18%, rgba(99,102,241,.10), transparent 30%); }
        .pay-masthead { animation: pay-rise .5s ease-out both; }
        @keyframes pay-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media print {
          .pay-root { background: #fff !important; color: #000 !important; }
          .pay-no-print { display: none !important; }
          .pay-receipt { background: #fff !important; border: 1px solid #ccc !important; color: #000 !important; }
          .pay-receipt * { color: #000 !important; }
        }
      `}</style>

      {/* ambient glow + grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 pay-no-print">
        <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] rounded-full bg-indigo-500/10 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 30%, transparent 75%)' }} />
      </div>

      <header className="relative z-10 border-b border-white/[0.08] bg-[#070b12]/80 backdrop-blur-xl pay-no-print">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-300 to-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-500/20"><Sparkles className="w-3.5 h-3.5" /></span>
            <span className="font-bold tracking-tight text-white group-hover:text-amber-200 transition-colors">PlanIt</span>
          </Link>
          <div className="flex items-center gap-3">
            {testnet && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2.5 py-1">
                <AlertTriangle className="w-3 h-3" /> TEST MODE · {network}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
              <Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Encrypted payment link</span>
            </span>
          </div>
        </div>
      </header>

      {offline && (
        <div className="relative z-10 bg-amber-400/10 border-b border-amber-400/30 text-amber-200 text-xs text-center py-2 pay-no-print">
          Connection problem — we keep retrying automatically. If you already sent payment, you don't need to do anything.
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-8 sm:py-10">
        {testnet && (
          <div className="mb-6 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-100 text-sm px-4 py-3 flex gap-3 pay-no-print">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div><strong>This is a test payment ({network}).</strong> Use test coins only — they have no real value. Never send real Bitcoin to this address.</div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

const glass = 'rounded-3xl border border-white/[0.09] bg-[#0d121c]/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.22)]';

function PaymentMasthead({ inv, meta, active }) {
  const Icon = meta.icon;
  return (
    <div className="pay-masthead mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300/80">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/10"><Icon className="h-3.5 w-3.5" /></span>
          PlanIt Payments
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">{active ? 'Complete your payment' : inv.status === 'confirmed' ? 'Payment complete' : 'Payment status'}</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{active ? 'A private checkout link for your PlanIt order. Review the amount, scan the code, and keep this page open while we confirm it.' : 'Your private payment link and receipt are kept together here for easy reference.'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-sky-300"><Receipt className="h-4 w-4" /></div>
        <div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Invoice</div><div className="mt-0.5 font-mono text-xs text-slate-200">{inv.id.slice(0, 8)}…{inv.id.slice(-4)}</div></div>
      </div>
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────────────────────── */
function Stepper({ status }) {
  const steps = ['Invoice ready', 'Payment sent', 'Confirming', 'Complete'];
  const current = status === 'confirmed' ? 4 : status === 'detected' ? 2 : 1; // index of the active step
  return (
    <ol className="flex items-center w-full" aria-label="Payment progress">
      {steps.map((label, i) => {
        const done = i < current || status === 'confirmed';
        const isActive = i === current && status !== 'confirmed';
        return (
          <li key={label} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5 min-w-[54px]">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all
                ${done ? 'bg-emerald-400 text-black border-emerald-300' : isActive ? 'bg-amber-400/15 text-amber-300 border-amber-400/60 ring-4 ring-amber-400/10' : 'bg-white/5 text-neutral-500 border-white/10'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : isActive ? <span className="w-2 h-2 rounded-full bg-amber-300" style={{ animation: 'pay-pulse 1.6s ease-in-out infinite' }} /> : i + 1}
              </span>
              <span className={`text-[10px] font-medium text-center leading-tight ${done ? 'text-emerald-300' : isActive ? 'text-amber-200' : 'text-neutral-500'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <span className={`flex-1 h-px mx-1 mb-5 ${done ? 'bg-emerald-400/60' : 'bg-white/10'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Countdown ring ───────────────────────────────────────────────────────── */
function Ring({ remainingMs, totalMs }) {
  const r = 20, c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, remainingMs / totalMs));
  const low = remainingMs < 120_000;
  return (
    <div className="relative w-14 h-14 shrink-0" role="timer" aria-label="Price lock countdown">
      <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          stroke={low ? '#f87171' : '#fbbf24'} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-mono font-semibold ${low ? 'text-red-300' : 'text-amber-200'}`}>
        {remainingMs > 0 ? mmss(remainingMs) : '00:00'}
      </span>
    </div>
  );
}

/* ── Active (pending / detected) ──────────────────────────────────────────── */
function ActiveCard({ inv, meta, amountBtc, amountSats, unit, setUnit, copy, copied, remainingMs, totalMs, busy, refresh, qr, integrity }) {
  const Icon = meta.icon;
  const detected = inv.status === 'detected';
  const confPct = inv.requiredConf > 0 ? Math.min(100, Math.round((inv.confirmations / inv.requiredConf) * 100)) : 100;
  const a = inv.address;
  const tx = txLink(inv);
  const amountText = unit === 'btc' ? amountBtc : String(amountSats);

  return (
    <div className={`${glass} p-5 sm:p-7 shadow-2xl shadow-black/40`}>
      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-300 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{meta.title}</h1>
            <p className="text-xs text-neutral-400 truncate">{inv.label ? `${inv.label} · ` : ''}{meta.sub}</p>
          </div>
        </div>
        {!detected && <Ring remainingMs={remainingMs} totalMs={totalMs} />}
      </div>

      <div className="mt-6"><Stepper status={inv.status} /></div>

      {inv.partial && (
        <div className="mt-5 rounded-xl bg-sky-400/10 border border-sky-400/30 text-sky-100 text-sm px-4 py-3 flex gap-3">
          <Coins className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
          <div>We received <strong>{fmtSats(inv.seenSats)} sats</strong> so far. Please send the remaining <strong className="font-mono">{inv.remainingBtc} BTC</strong> to the <em>same address</em> below — no need to start over.</div>
        </div>
      )}

      {/* Integrity failure: fail closed */}
      {!integrity.ok && (
        <div className="mt-6 rounded-xl bg-red-500/10 border border-red-400/40 text-red-100 px-4 py-4">
          <div className="flex items-center gap-2 font-bold mb-1"><ShieldAlert className="w-5 h-5 text-red-300" /> Don't pay yet — something looks off</div>
          <ul className="text-sm list-disc pl-5 space-y-0.5 text-red-100/90">
            {integrity.checks.filter((c) => !c.ok).map((c) => <li key={c.id}>{c.bad}</li>)}
          </ul>
          <p className="text-xs text-red-200/80 mt-2">Reload this page. If it keeps happening, email {SUPPORT_EMAIL} — we've hidden the payment details to keep you safe.</p>
        </div>
      )}

      {integrity.ok && (
        <>
          {/* Amount hero */}
          <div className="mt-6 rounded-2xl border border-sky-300/20 bg-gradient-to-b from-sky-400/[0.08] to-transparent p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300/90">
              Send exactly
              <span className="inline-flex rounded-full bg-black/40 border border-white/10 p-0.5 normal-case tracking-normal">
                {['btc', 'sats'].map((u) => (
                  <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${unit === u ? 'bg-amber-400 text-black' : 'text-neutral-400 hover:text-white'}`}>{u}</button>
                ))}
              </span>
            </div>
            <button type="button" onClick={() => copy('amt', amountText)} className="group mt-2 inline-flex items-center gap-3 max-w-full" aria-label="Copy amount">
              <span className="font-mono text-3xl sm:text-4xl font-bold text-white tracking-tight break-all">{unit === 'sats' ? fmtSats(amountSats) : amountBtc}</span>
              <span className="text-sm font-semibold text-neutral-400">{unit === 'btc' ? 'BTC' : 'sats'}</span>
              <span className="p-1.5 rounded-lg border border-white/10 text-neutral-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                {copied === 'amt' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </span>
            </button>
            <p className="text-xs text-neutral-400 mt-1.5">
              ≈ <strong className="text-neutral-200">${inv.usd.toFixed(2)} USD</strong> · 1 BTC = ${Number(inv.rateUsd).toLocaleString()}
            </p>
          </div>

          {/* QR + address */}
          <div className="mt-5 grid sm:grid-cols-[auto_minmax(0,1fr)] gap-5 items-center">
            <div className="mx-auto">
              <div className="relative p-2.5 rounded-2xl bg-white shadow-xl shadow-black/50">
                {qr
                  ? <img src={qr} alt="Bitcoin payment QR code" width={208} height={208} className="block w-[208px] h-[208px]" />
                  : <div className="w-[208px] h-[208px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>}
                {detected && <div className="absolute inset-0 rounded-2xl bg-white/80 backdrop-blur-[2px] flex items-center justify-center"><CheckCircle2 className="w-14 h-14 text-emerald-500" /></div>}
              </div>
              <p className="text-[10px] text-neutral-500 text-center mt-2 flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> QR drawn in your browser</p>
            </div>

            <div className="min-w-0 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Payment address</span>
                  <button type="button" onClick={() => copy('addr', a)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200">
                    {copied === 'addr' ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 font-mono text-[13px] leading-6 break-all select-all">
                  {chunk(a).map((c, i, arr) => (
                    <span key={i} className={i === 0 || i === arr.length - 1 || i === 1 || i === arr.length - 2 ? 'text-amber-200 font-semibold' : 'text-neutral-300'}>{c}{' '}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-400/[0.06] border border-emerald-400/20 px-3 py-2.5 text-xs text-emerald-100/90 flex gap-2.5">
                <Fingerprint className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-emerald-200">Verify before you send.</strong> Your wallet's confirm screen should begin with{' '}
                  <code className="font-mono text-amber-200">{a.slice(0, 8)}</code> and end with <code className="font-mono text-amber-200">{a.slice(-8)}</code>.
                  If it doesn't, stop.
                </span>
              </div>

              <a href={inv.uri} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-400 to-violet-500 text-white text-sm font-bold px-4 py-3 shadow-lg shadow-indigo-500/20 hover:brightness-110 active:scale-[.99] transition">
                <Wallet className="w-4 h-4" /> Open in wallet app
              </a>
            </div>
          </div>

          {/* Live status */}
          <div className="mt-5 rounded-xl border border-white/10 bg-black/30 px-4 py-3.5" aria-live="polite">
            {detected ? (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                  <Zap className="w-4 h-4" /> Payment detected on the network
                </div>
                <div className="mt-2.5 h-2 rounded-full bg-white/10 overflow-hidden relative">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-700" style={{ width: `${Math.max(8, confPct)}%` }} />
                  <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" style={{ animation: 'pay-sweep 2s linear infinite' }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-neutral-300">
                  <span>Confirmations <strong className="text-white">{inv.confirmations}</strong> / {inv.requiredConf}</span>
                  <span className="text-neutral-400">Roughly 10 minutes per confirmation. You can close this page — we'll finish automatically.</span>
                </div>
                {tx && <a href={tx} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200">View transaction <ExternalLink className="w-3 h-3" /></a>}
              </>
            ) : (
              <div className="flex items-start gap-3">
                <span className="relative flex w-2.5 h-2.5 mt-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping" /><span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-amber-400" /></span>
                <div className="text-sm text-neutral-300">
                  <strong className="text-white">Waiting for your payment…</strong>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    This page updates by itself the moment your transaction appears.{' '}
                    {inv.requiredConf === 0 ? 'This amount is accepted as soon as it is seen.' : `This order needs ${inv.requiredConf} confirmation${inv.requiredConf > 1 ? 's' : ''} (about ${inv.requiredConf * 10} min).`}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={refresh} disabled={busy}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 py-2.5 text-sm font-medium text-neutral-200 disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> I've paid — check now
          </button>

          <ul className="mt-4 grid sm:grid-cols-3 gap-2 text-[11px] text-neutral-400">
            <li className="flex gap-2"><Coins className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" /> Send the exact amount. Your wallet adds the network fee on top.</li>
            <li className="flex gap-2"><Landmark className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" /> On-chain Bitcoin only. Lightning payments are not supported.</li>
            <li className="flex gap-2"><Clock className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-px" /> Price is locked until the timer ends. Late? You'll get a fresh quote.</li>
          </ul>

          <IntegrityList checks={integrity.checks} />
        </>
      )}
    </div>
  );
}

function IntegrityList({ checks }) {
  return (
    <details className="mt-4 group rounded-xl border border-white/10 bg-black/20">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-300">
        <span className="inline-flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> {checks.length} automatic safety checks passed</span>
        <ChevronDown className="w-4 h-4 text-neutral-500 group-open:rotate-180 transition-transform" />
      </summary>
      <ul className="px-4 pb-3 space-y-1.5 text-xs text-neutral-300">
        {checks.map((c) => <li key={c.id} className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {c.label}</li>)}
        <li className="text-[11px] text-neutral-500 pt-1">These run in your browser on the data this page received. They don't replace comparing the address in your own wallet.</li>
      </ul>
    </details>
  );
}

/* ── Confirmed ────────────────────────────────────────────────────────────── */
function ConfirmedCard({ inv, meta, next, copy, copied }) {
  const tx = txLink(inv);
  return (
    <div className={`${glass} pay-receipt p-6 sm:p-8 shadow-2xl shadow-black/40`}>
      <div className="text-center">
        <div className="pay-pop w-20 h-20 rounded-full bg-emerald-400/15 border border-emerald-400/40 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path className="pay-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Payment confirmed</h1>
        <p className="text-sm text-neutral-400 mt-1.5">
          {next ? 'Thank you! Taking you to your confirmation in a few seconds…' : 'Thank you! Your subscription is paid and your service is active.'}
        </p>
        {next && (
          <Link to={next} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-400 to-violet-500 text-white text-sm font-bold px-5 py-2.5 shadow-lg shadow-indigo-500/20 hover:brightness-110 pay-no-print">
            Continue now <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="mt-7 rounded-xl border border-white/10 bg-black/30 divide-y divide-white/5 text-sm">
        <Row k="Receipt for" v={`${meta.title}${inv.label ? ` — ${inv.label}` : ''}`} />
        <Row k="Amount" v={`$${inv.usd.toFixed(2)} USD`} />
        <Row k="Bitcoin paid" v={`${inv.btc} BTC`} mono />
        <Row k="Rate used" v={`1 BTC = $${Number(inv.rateUsd).toLocaleString()}`} />
        <Row k="Network" v={inv.network === 'mainnet' ? 'Bitcoin mainnet' : `${inv.network} (test)`} />
        <Row k="Confirmed" v={when(inv.paidAt)} />
        <Row k="Invoice ID" v={inv.id} mono small action={<CopyBtn onClick={() => copy('id', inv.id)} done={copied === 'id'} />} />
        {inv.txid && <Row k="Transaction" v={inv.txid} mono small action={tx && <a href={tx} target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:text-amber-200 pay-no-print" aria-label="View transaction"><ExternalLink className="w-4 h-4" /></a>} />}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 justify-center pay-no-print">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-neutral-200">
          <Printer className="w-4 h-4" /> Print / save receipt
        </button>
        <Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/10 px-4 py-2.5 text-sm font-medium text-neutral-200">Back to PlanIt</Link>
      </div>
      <p className="text-[11px] text-neutral-500 text-center mt-4">Keep your invoice ID. We don't email receipts — this page is your proof of payment.</p>
    </div>
  );
}

const Row = ({ k, v, mono, small, action }) => (
  <div className="flex items-start justify-between gap-4 px-4 py-2.5">
    <span className="text-neutral-400 shrink-0">{k}</span>
    <span className={`text-right text-neutral-100 min-w-0 break-all ${mono ? 'font-mono' : ''} ${small ? 'text-[11px] leading-5' : ''} flex items-center gap-2 justify-end`}>
      <span className="min-w-0">{v}</span>{action}
    </span>
  </div>
);
const CopyBtn = ({ onClick, done }) => (
  <button onClick={onClick} className="p-1 rounded-md text-neutral-400 hover:text-white pay-no-print" aria-label="Copy">
    {done ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
  </button>
);

/* ── Expired / Review / Rejected ──────────────────────────────────────────── */
function ExpiredCard({ busy, requote, error, inv }) {
  return (
    <div className={`${glass} p-8 text-center`}>
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5"><Clock className="w-8 h-8 text-neutral-400" /></div>
      <h1 className="text-xl font-bold text-white mb-2">This quote expired</h1>
      <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">Bitcoin's price moves, so each quote is only held for a short time. <strong className="text-neutral-200">Nothing was charged.</strong> Get a fresh quote to continue — it takes a second.</p>
      <button onClick={requote} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-300 via-indigo-400 to-violet-500 text-white text-sm font-bold px-6 py-3 shadow-lg shadow-indigo-500/20 hover:brightness-110 disabled:opacity-60">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Get a new quote
      </button>
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
      <div className="mt-6 text-xs text-neutral-500 border-t border-white/10 pt-4">
        Already sent a payment to the old address? Don't send it again — it will be flagged for a person to review automatically. Keep invoice ID <span className="font-mono text-neutral-300">{inv.id.slice(0, 8)}</span>.
      </div>
    </div>
  );
}

function ReviewCard({ inv, copy, copied }) {
  const tx = txLink(inv);
  return (
    <div className={`${glass} p-8 text-center`}>
      <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-5"><LifeBuoy className="w-8 h-8 text-amber-300" /></div>
      <h1 className="text-xl font-bold text-white mb-2">We're reviewing your payment</h1>
      <p className="text-sm text-neutral-300 max-w-md mx-auto">
        A payment arrived that doesn't exactly match this order — for example it came after the quote expired, or it was a partial amount.
        A person will review it. <strong className="text-white">Please don't send it again.</strong>
      </p>
      <div className="mt-5 rounded-xl bg-black/30 border border-white/10 p-4 text-left text-sm space-y-2">
        <div className="flex justify-between gap-3"><span className="text-neutral-400">Invoice ID</span>
          <span className="font-mono text-xs text-neutral-100 flex items-center gap-2 break-all">{inv.id}<CopyBtn onClick={() => copy('id', inv.id)} done={copied === 'id'} /></span></div>
        <div className="flex justify-between gap-3"><span className="text-neutral-400">Received so far</span><span className="font-mono text-neutral-100">{fmtSats(inv.seenSats)} sats</span></div>
        <div className="flex justify-between gap-3"><span className="text-neutral-400">Order total</span><span className="font-mono text-neutral-100">{fmtSats(inv.sats)} sats</span></div>
      </div>
      {tx && <a href={tx} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200">View your transaction <ExternalLink className="w-3 h-3" /></a>}
      <p className="text-xs text-neutral-500 mt-4">Questions? Email <a className="text-amber-300 underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}?subject=Payment%20review%20${inv.id.slice(0, 8)}`}>{SUPPORT_EMAIL}</a> with your invoice ID.</p>
    </div>
  );
}

function RejectedCard({ inv }) {
  return (
    <div className={`${glass} p-8 text-center`}>
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-center justify-center mx-auto mb-5"><XCircle className="w-8 h-8 text-red-300" /></div>
      <h1 className="text-xl font-bold text-white mb-2">Payment not accepted</h1>
      <p className="text-sm text-neutral-300 max-w-sm mx-auto">This payment couldn't be accepted for this order. Please email <a className="text-amber-300 underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}?subject=Rejected%20payment%20${inv.id.slice(0, 8)}`}>{SUPPORT_EMAIL}</a> with invoice ID <span className="font-mono text-neutral-100">{inv.id.slice(0, 8)}</span> and we'll sort it out.</p>
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
function OrderSummary({ inv, meta }) {
  const Icon = meta.icon;
  return (
    <section className={`${glass} p-5 pay-receipt`} aria-label="Order summary">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3"><Receipt className="w-4 h-4 text-amber-300" /> Order summary</h2>
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <span className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"><Icon className="w-4 h-4 text-amber-300" /></span>
        <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{meta.title}</div><div className="text-xs text-neutral-400 truncate">{inv.label || meta.sub}</div></div>
        <div className="ml-auto text-lg font-bold text-white">${inv.usd.toFixed(2)}</div>
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <Kv k="Total in Bitcoin" v={`${inv.btc} BTC`} mono />
        <Kv k="Exchange rate" v={`$${Number(inv.rateUsd).toLocaleString()} / BTC`} />
        <Kv k="Network fee" v="Paid by you, in your wallet" />
        <Kv k="PlanIt fee" v="None — you pay the price shown" />
        <Kv k="Confirmations" v={inv.requiredConf === 0 ? 'Instant (0)' : `${inv.requiredConf} (≈ ${inv.requiredConf * 10} min)`} />
        <Kv k="Created" v={when(inv.createdAt)} />
        <Kv k="Invoice ID" v={`${inv.id.slice(0, 8)}…${inv.id.slice(-4)}`} mono />
      </dl>
    </section>
  );
}
const Kv = ({ k, v, mono }) => (
  <div className="flex justify-between gap-3"><dt className="text-neutral-400">{k}</dt><dd className={`text-right text-neutral-100 ${mono ? 'font-mono' : ''}`}>{v}</dd></div>
);

function HowToPay() {
  const tabs = [
    { id: 'phone', label: 'Phone wallet', icon: Smartphone, steps: [
      'Open your Bitcoin wallet (e.g. Proton Wallet, Blue Wallet, Muun, Cash App) and tap Send.',
      'Tap the scan icon and point the camera at the QR code — or tap "Open in wallet app".',
      'Check the address ends match and the amount equals what is shown.',
      'Confirm. This page flips to "Payment detected" within seconds.',
    ] },
    { id: 'exchange', label: 'Exchange', icon: Landmark, steps: [
      'In Coinbase, Kraken, Cash App, Strike, etc., choose Send / Withdraw → Bitcoin (on-chain, not Lightning).',
      'Paste the address and enter the BTC amount. Use "Copy" above to avoid typos.',
      'Make sure the amount RECEIVED equals the amount shown. If the exchange subtracts its fee from the amount, raise the withdrawal so the full amount arrives.',
      'Some exchanges hold withdrawals for review — if that takes longer than the timer, you may be asked to get a fresh quote or we will review it manually.',
    ] },
    { id: 'desktop', label: 'Desktop wallet', icon: Monitor, steps: [
      'In Sparrow, Electrum, or Proton Wallet choose Send.',
      'Paste the address and the amount. Turn OFF "subtract fee from amount".',
      'Pick a normal fee. Higher fee = faster confirmation; very low fees can stall.',
      'Review the address ends, then sign and broadcast.',
    ] },
  ];
  const [tab, setTab] = useState('phone');
  const cur = tabs.find((t) => t.id === tab);
  return (
    <section className={`${glass} p-5`} aria-label="How to pay">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3"><Wallet className="w-4 h-4 text-amber-300" /> How to pay</h2>
      <div className="flex gap-1.5 p-1 rounded-xl bg-black/30 border border-white/10" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${tab === t.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <ol className="mt-4 space-y-3">
        {cur.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-xs text-neutral-300 leading-relaxed">
            <span className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-200 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <Link to="/help#btc-how-to-pay" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200">Full step-by-step guide <ArrowRight className="w-3 h-3" /></Link>
    </section>
  );
}

function SecurityPanel({ integrity }) {
  const items = [
    { icon: KeyRound, t: 'We can’t spend your money — or ours', d: 'PlanIt’s server only holds a public, watch-only key. It can create receive addresses but can never move funds, so a server breach can’t drain the wallet.' },
    { icon: Fingerprint, t: 'A fresh address for every order', d: 'Each invoice gets its own never-used address, checked on the blockchain before it’s shown to you.' },
    { icon: ShieldCheck, t: 'Price and address are set by our server', d: 'Your browser never supplies an amount or address, so neither can be altered by the link you opened.' },
    { icon: EyeOff, t: 'Your email is encrypted, then erased', d: 'Stored with AES-256-GCM and wiped once your order is fulfilled. IP addresses are kept only as one-way hashes for abuse limits.' },
    { icon: Lock, t: 'No account. No card.', d: 'Nothing to hack or leak: no card numbers, no saved payment method, no password.' },
  ];
  return (
    <section className={`${glass} p-5`} aria-label="Security">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-1"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Why this is safe</h2>
      <p className="text-[11px] text-neutral-500 mb-3">{integrity?.ok === false ? 'Safety checks failed on this page — see the warning.' : 'Built so there’s very little to trust.'}</p>
      <ul className="space-y-3">
        {items.map(({ icon: I, t, d }) => (
          <li key={t} className="flex gap-3">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center"><I className="w-4 h-4 text-emerald-300" /></span>
            <div><div className="text-xs font-semibold text-white">{t}</div><div className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">{d}</div></div>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-amber-400/[0.07] border border-amber-400/20 p-3 text-[11px] text-amber-100/90 leading-relaxed">
        <strong className="text-amber-200">Stay safe from scams:</strong> only pay the address shown on this page, on this website. If anyone messages you a different address "for PlanIt", don't pay it. Bitcoin payments can’t be reversed.
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */
function Faq() {
  const [open, setOpen] = useState(0);
  const items = [
    { q: 'How long does it take?', a: 'Donations and small payments are accepted as soon as they appear on the network (seconds). Larger orders wait for 1–2 confirmations, roughly 10 minutes each. The page shows live progress, and you can safely close it — we keep watching the blockchain.' },
    { q: 'Who pays the network fee?', a: 'You do, inside your wallet, on top of the amount shown. PlanIt doesn’t add any fee. For faster confirmation choose a higher fee in your wallet.' },
    { q: 'I sent the wrong amount. What now?', a: 'Slightly under (within about 1%) is accepted. If you sent less than that, the page shows the remaining amount — send the difference to the same address. If you sent more, you’re still fine; contact us if you want to discuss the overpayment.' },
    { q: 'I paid after the timer ran out.', a: 'Don’t panic and don’t pay twice. Late payments are flagged for a person to review, and the order is completed manually. Keep your invoice ID and email us if you don’t hear back.' },
    { q: 'Can I pay with Lightning, PayPal or a card?', a: 'Not at the moment. PlanIt Payments accepts on-chain Bitcoin only.' },
    { q: 'Can I get a refund?', a: 'Bitcoin transactions can’t be reversed, so refunds are handled manually and case by case. Email us with your invoice ID.' },
  ];
  return (
    <section className={`${glass} p-5 sm:p-6`} aria-label="Frequently asked questions">
      <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3"><Sparkles className="w-4 h-4 text-amber-300" /> Quick answers</h2>
      <div className="divide-y divide-white/10">
        {items.map((it, i) => (
          <div key={it.q}>
            <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="w-full flex items-center justify-between gap-3 py-3 text-left">
              <span className="text-sm font-medium text-neutral-100">{it.q}</span>
              <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="pb-3.5 text-[13px] text-neutral-400 leading-relaxed">{it.a}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <Link to="/help#btc-what-is-bitcoin" className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1">New to Bitcoin? <ArrowRight className="w-3 h-3" /></Link>
        <Link to="/help#btc-how-to-pay" className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1">How to pay PlanIt <ArrowRight className="w-3 h-3" /></Link>
        <Link to="/help#btc-pay-problems" className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1">Payment problems <ArrowRight className="w-3 h-3" /></Link>
      </div>
    </section>
  );
}
