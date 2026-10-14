import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowUpRight, Check, CheckCircle2, ChevronDown, Clock, Copy, EyeOff, Fingerprint,
  HelpCircle, KeyRound, Landmark, LifeBuoy, Loader2, Lock, Monitor, Printer, Receipt, RefreshCw,
  ShieldAlert, ShieldCheck, Smartphone, Sparkles, Wallet, X, XCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * PlanIt Payments: Bitcoin pay page (/pay/:id)
 *
 * The invoice id in the URL is a 128-bit random value and is the only
 * credential needed to view the page. The browser never sends an amount or an
 * address anywhere; it only displays what the server issued, and runs a few
 * integrity checks on that data before it lets anyone pay (see `useIntegrity`).
 *
 * Layout: one calm column. The amount, the QR code and the address are always
 * visible. Everything else (order details, how to pay, security, questions)
 * lives behind small buttons and opens in a sheet when someone asks for it.
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
const SUPPORT_EMAIL = 'planit.userhelp@gmail.com';

/* What is being bought */
const PURPOSE = {
  support:          { title: 'Support PlanIt',           sub: 'One-time donation' },
  feature_request:  { title: 'Feature request',          sub: 'Funds your requested feature' },
  wl_setup:         { title: 'White Label setup fee',    sub: 'One-time, before we begin' },
  wl_subscription:  { title: 'White Label subscription', sub: '30 days of service' },
};

const successUrl = (inv) => {
  if (inv.purpose === 'support')         return `/support/success?invoice=${inv.id}`;
  if (inv.purpose === 'feature_request') return `/support/success?invoice=${inv.id}&type=feature`;
  if (inv.purpose === 'wl_setup')        return `/white-label/setup-success?invoice=${inv.id}`;
  return null; // subscription: stay here and show the receipt
};

/* Helpers */
const chunk = (addr) => addr.match(/.{1,4}/g) || [addr];
const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const explorerBase = (network) => `https://mempool.space/${network === 'mainnet' ? '' : `${network}/`}`;
const txLink = (inv) => (inv?.txid ? `${explorerBase(inv.network)}tx/${inv.txid}` : null);
const btcToSats = (s) => Number(String(s).replace('.', ''));
const fmtSats = (n) => Number(n).toLocaleString();
const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const rateText = (n) => `$${Number(n).toLocaleString()}`;
const when = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available');

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
      { id: 'uri',  ok: uriOk,  label: 'QR code and wallet link match the address and amount shown', bad: 'The QR code or wallet link does not match the details on screen.' },
      { id: 'tls',  ok: secure, label: `Connection to ${host || 'this site'} is encrypted (HTTPS)`, bad: 'This page is not on a secure (HTTPS) connection.' },
    ];
    return { ok: checks.every((c) => c.ok), checks };
  }, [inv, amountBtc]);
}

/* Shared style tokens */
const linkCls = 'font-medium text-[#635bff] transition-colors hover:text-[#4338ca]';
const primaryBtn = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] px-6 text-[15px] font-medium text-white transition hover:bg-black active:scale-[0.99] disabled:opacity-60';
const secondaryBtn = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e8e8ed] bg-white px-6 text-[15px] font-medium text-[#1d1d1f] transition hover:bg-[#fafafa] active:scale-[0.99] disabled:opacity-60';

/* Page */
export default function Pay() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const [unit, setUnit] = useState('btc'); // 'btc' | 'sats'
  const [sheet, setSheet] = useState(null); // null | 'details' | 'how' | 'security' | 'faq'
  const redirected = useRef(false);

  useEffect(() => {
    document.title = inv ? `Pay ${money(inv.usd)} with Bitcoin | PlanIt` : 'Pay with Bitcoin | PlanIt';
  }, [inv]);

  // Load + live updates (socket for speed, polling as the safety net)
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

  const amountBtc = inv ? (inv.partial ? inv.remainingBtc : inv.btc) : '';
  const amountSats = inv ? (inv.partial ? btcToSats(inv.remainingBtc) : inv.sats) : 0;
  const integrity = useIntegrity(inv, amountBtc);

  // QR code (generated locally, the address never leaves the browser)
  useEffect(() => {
    if (!inv?.uri || !integrity.ok) { setQr(''); return; }
    QRCode.toDataURL(inv.uri, { margin: 2, width: 360, errorCorrectionLevel: 'M', color: { dark: '#0a0a0a', light: '#ffffff' } })
      .then(setQr).catch(() => setQr(''));
  }, [inv?.uri, integrity.ok]);

  // No auto-redirect on success: the receipt stays on screen and the buyer
  // presses Continue (ConfirmedCard) when they are ready to move on.

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

  /* Early states */
  if (error && !inv) {
    return (
      <Shell>
        <div className="py-16 text-center">
          <IconBadge><AlertTriangle className="h-5 w-5 text-[#1d1d1f]" strokeWidth={1.75} /></IconBadge>
          <h1 className="mt-7 text-[24px] font-semibold tracking-[-0.025em]">Payment link not found</h1>
          <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-6 text-[#6e6e73]">{error}</p>
          <Link to="/support" className={`mt-8 inline-flex items-center gap-1 text-[15px] ${linkCls}`}>Back to PlanIt</Link>
        </div>
      </Shell>
    );
  }
  if (!inv) {
    return (
      <Shell offline={offline}>
        <div className="py-32 text-center" role="status">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#8e8e93]" />
          <p className="mt-5 text-[15px] text-[#6e6e73]">Securing your payment</p>
          {offline && <p className="mt-2 text-[13px] text-[#6e6e73]">Having trouble reaching PlanIt. Retrying.</p>}
        </div>
      </Shell>
    );
  }

  const testnet = inv.network !== 'mainnet';
  const meta = PURPOSE[inv.purpose] || { title: 'PlanIt payment', sub: '' };
  const ctx = { inv, meta, amountBtc, amountSats, unit, setUnit, copy, copied, busy, refresh, requote, qr, integrity, error };

  const pills = [
    inv.status !== 'confirmed' && { id: 'details', label: 'Order details', icon: Receipt },
    active && { id: 'how', label: 'How to pay', icon: Wallet },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'faq', label: 'Questions', icon: HelpCircle },
  ].filter(Boolean);

  return (
    <Shell testnet={testnet} network={inv.network} offline={offline}>
      <div className="pay-rise">
        {active && <Summary inv={inv} meta={meta} />}

        <div className={active ? 'mt-10' : ''}>
          {active && <ActiveCard {...ctx} />}
          {inv.status === 'confirmed' && <ConfirmedCard {...ctx} next={successUrl(inv)} />}
          {inv.status === 'expired' && <ExpiredCard {...ctx} />}
          {inv.status === 'review' && <ReviewCard {...ctx} />}
          {inv.status === 'rejected' && <RejectedCard {...ctx} />}
        </div>

        <div className="pay-no-print mt-12 flex flex-wrap justify-center gap-2.5">
          {pills.map(({ id: pid, label, icon: Icon }) => (
            <button
              key={pid}
              type="button"
              onClick={() => setSheet(pid)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e8e8ed] bg-white px-4 text-[14px] font-medium text-[#1d1d1f] transition hover:border-[#d2d2d7] hover:bg-[#fafafa] active:scale-[0.98]"
            >
              <Icon className="h-4 w-4 text-[#6e6e73]" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </div>

        <p className="pay-no-print mt-14 text-center text-[13px] leading-6 text-[#6e6e73]">
          Need help? Read the <Link to="/help#btc-how-to-pay" className={linkCls}>payment guide</Link> or email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className={linkCls}>{SUPPORT_EMAIL}</a> with invoice{' '}
          <span className="pay-mono text-[#1d1d1f]">{inv.id.slice(0, 8)}</span>.
        </p>
      </div>

      {sheet && (
        <Sheet key={sheet} title={SHEET_TITLES[sheet]} onClose={() => setSheet(null)}>
          {sheet === 'details' && <DetailsSheet {...ctx} />}
          {sheet === 'how' && <HowSheet />}
          {sheet === 'security' && <SecuritySheet integrity={integrity} active={!!active} />}
          {sheet === 'faq' && <FaqSheet />}
        </Sheet>
      )}
    </Shell>
  );
}

const SHEET_TITLES = {
  details: 'Order details',
  how: 'How to pay',
  security: 'Security',
  faq: 'Questions',
};

/* Chrome */
const PAY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');
  .pay-root {
    font-family: 'Geist', 'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }
  .pay-mono { font-family: 'Geist Mono', 'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
  .pay-root :focus-visible { outline: 2px solid #635bff; outline-offset: 2px; }
  .pay-root :focus:not(:focus-visible) { outline: none; }
  .pay-root button, .pay-root a { -webkit-tap-highlight-color: transparent; }

  @keyframes pay-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
  @keyframes pay-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes pay-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pay-fade-out { from { opacity: 1; } to { opacity: 0; } }
  @keyframes pay-sheet-in { from { opacity: 0; transform: translateY(24px) scale(0.985); } to { opacity: 1; transform: none; } }
  @keyframes pay-sheet-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(14px) scale(0.99); } }
  @keyframes pay-draw { to { stroke-dashoffset: 0; } }

  .pay-rise { animation: pay-rise .5s cubic-bezier(.2,.7,.2,1) both; }
  .pay-ping { animation: pay-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }
  .pay-fade-in { animation: pay-fade-in .2s ease-out both; }
  .pay-fade-out { animation: pay-fade-out .17s ease-in both; }
  .pay-sheet-in { animation: pay-sheet-in .32s cubic-bezier(.2,.8,.2,1) both; }
  .pay-sheet-out { animation: pay-sheet-out .17s ease-in both; }
  .pay-draw { stroke-dasharray: 32; stroke-dashoffset: 32; animation: pay-draw .45s .15s cubic-bezier(.4,0,.2,1) forwards; }

  @media (prefers-reduced-motion: reduce) {
    .pay-root *, .pay-root *::before, .pay-root *::after {
      animation-duration: .01ms !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
  @media print {
    .pay-root { background: #fff !important; color: #000 !important; }
    .pay-no-print { display: none !important; }
  }
`;

function Shell({ children, testnet, network, offline }) {
  return (
    <div className="pay-root min-h-screen overflow-x-hidden bg-white text-[#1d1d1f]">
      <style>{PAY_CSS}</style>

      <header className="pay-no-print">
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="PlanIt home">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[#1d1d1f] text-white"><Sparkles className="h-3.5 w-3.5" /></span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">PlanIt</span>
          </Link>
          {testnet && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[12px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              Test mode <span className="text-amber-700/70">{network}</span>
            </span>
          )}
        </div>
      </header>

      {offline && (
        <div className="pay-no-print bg-amber-50 px-5 py-2.5 text-center text-[13px] text-amber-900" role="status">
          Connection problem. We keep retrying automatically. If you already sent payment, you do not need to do anything.
        </div>
      )}

      <main className="mx-auto w-full max-w-[460px] px-5 pb-24 pt-10 sm:pt-16">
        {testnet && (
          <div className="pay-no-print mb-10 rounded-2xl bg-amber-50 px-5 py-4 text-[14px] leading-6 text-amber-900">
            <strong className="font-semibold">This is a test payment on {network}.</strong> Use test coins only, they have no real value. Never send real Bitcoin to this address.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

const IconBadge = ({ children }) => (
  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f5f5f7]">{children}</span>
);

/* Sheet (the surface every hidden detail opens in) */
function Sheet({ title, onClose, children }) {
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const timer = useRef(null);

  const close = useCallback(() => {
    if (timer.current) return;
    setLeaving(true);
    timer.current = setTimeout(() => closeRef.current(), 170);
  }, []);

  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      if (e.shiftKey && (here === first || here === panelRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer.current);
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [close]);

  return (
    <div className="pay-no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className={`absolute inset-0 bg-black/[0.18] backdrop-blur-[3px] ${leaving ? 'pay-fade-out' : 'pay-fade-in'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.04)] outline-none sm:max-w-[520px] sm:rounded-[24px] ${leaving ? 'pay-sheet-out' : 'pay-sheet-in'}`}
      >
        <div className="flex items-center justify-between px-7 pb-3 pt-7">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f7] text-[#6e6e73] transition-colors hover:bg-[#ececf0] hover:text-[#1d1d1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overscroll-contain overflow-y-auto px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-3">{children}</div>
      </div>
    </div>
  );
}

/* Small pieces */
function Segmented({ value, onChange, options, label, tabs, full }) {
  return (
    <div
      role={tabs ? 'tablist' : 'group'}
      aria-label={label}
      className={`${full ? 'flex w-full' : 'inline-flex'} rounded-[10px] bg-[#f5f5f7] p-0.5`}
    >
      {options.map(({ id, text, icon: Icon }) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? on : undefined}
            aria-pressed={tabs ? undefined : on}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-all ${full ? 'flex-1' : ''} ${on ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(0,0,0,0.04)]' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {text}
          </button>
        );
      })}
    </div>
  );
}

const CopyChip = ({ done }) => (
  <span className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f5f5f7] text-[#1d1d1f] group-hover:bg-[#ececf0]'}`}>
    {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    {done ? 'Copied' : 'Copy'}
  </span>
);

const CopyBtn = ({ onClick, done }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Copy"
    className="pay-no-print grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
  >
    {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
  </button>
);

const Row = ({ k, v, mono, small, action }) => (
  <div className="flex items-start justify-between gap-6 py-4">
    <dt className="shrink-0 text-[14px] text-[#6e6e73]">{k}</dt>
    <dd className="flex min-w-0 items-center justify-end gap-2 text-right text-[14px] text-[#1d1d1f]">
      <span className={`min-w-0 break-all ${mono ? 'pay-mono' : ''} ${small ? 'text-[12px] leading-5' : ''}`}>{v}</span>
      {action}
    </dd>
  </div>
);

function PriceLock({ expiresAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = new Date(expiresAt).getTime() - now;
  const low = ms < 120_000;
  return (
    <span role="timer" className={`tabular-nums ${low ? 'font-medium text-red-600' : 'text-[#1d1d1f]'}`}>
      {ms > 0 ? mmss(ms) : '00:00'}
    </span>
  );
}

/* Top of the page while a payment is open */
function Summary({ inv, meta }) {
  return (
    <div>
      <p className="text-[15px] font-medium text-[#6e6e73]">{meta.title}</p>
      <h1 className="mt-2 text-[46px] font-semibold leading-none tracking-[-0.035em] tabular-nums sm:text-[54px]">{money(inv.usd)}</h1>
      {(inv.label || meta.sub) && <p className="mt-4 text-[15px] leading-6 text-[#6e6e73]">{inv.label || meta.sub}</p>}
    </div>
  );
}

/* Active (pending / detected) */
function ActiveCard({ inv, amountBtc, amountSats, unit, setUnit, copy, copied, busy, refresh, qr, integrity }) {
  // "Open in wallet" is a bitcoin: link. If no app on the device handles it, the browser
  // stays put (Safari shows an error). We notice that and point to the QR code instead.
  const [noWallet, setNoWallet] = useState(false);
  const walletTimer = useRef(null);
  useEffect(() => () => clearTimeout(walletTimer.current), []);
  const openWallet = () => {
    clearTimeout(walletTimer.current);
    setNoWallet(false);
    let left = false;
    const leave = () => { left = true; };
    window.addEventListener('blur', leave, { once: true });
    window.addEventListener('pagehide', leave, { once: true });
    document.addEventListener('visibilitychange', leave, { once: true });
    walletTimer.current = setTimeout(() => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', leave);
      if (!left) setNoWallet(true);
    }, 1800);
  };

  const detected = inv.status === 'detected';
  const confPct = inv.requiredConf > 0 ? Math.min(100, Math.round((inv.confirmations / inv.requiredConf) * 100)) : 100;
  const a = inv.address;
  const tx = txLink(inv);
  const amountText = unit === 'btc' ? amountBtc : String(amountSats);
  const parts = chunk(a);

  // Fail closed: if anything looks off, hide every payment detail.
  if (!integrity.ok) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-6 text-[14px] leading-6 text-red-900" role="alert">
        <div className="flex items-center gap-2 text-[16px] font-semibold"><ShieldAlert className="h-5 w-5 text-red-600" /> Do not pay yet</div>
        <p className="mt-2">Something on this page looks off, so we hid the payment details to keep you safe.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {integrity.checks.filter((c) => !c.ok).map((c) => <li key={c.id}>{c.bad}</li>)}
        </ul>
        <p className="mt-4 text-[13px] text-red-800">Reload this page. If it keeps happening, email {SUPPORT_EMAIL}.</p>
      </div>
    );
  }

  return (
    <>
      {inv.partial && (
        <div className="mb-6 rounded-2xl bg-[#f5f5f7] px-5 py-4 text-[14px] leading-6">
          We received <strong className="font-semibold">{fmtSats(inv.seenSats)} sats</strong> so far. Send the remaining{' '}
          <span className="pay-mono font-medium">{inv.remainingBtc} BTC</span> to the same address below. No need to start over.
        </div>
      )}

      <div className="overflow-hidden rounded-[22px] border border-[#e8e8ed] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.08)]">
        {/* QR */}
        <div className="flex justify-center px-6 pb-8 pt-10">
          <div className="relative rounded-2xl border border-[#f0f0f3] p-2">
            {qr
              ? <img src={qr} alt="Bitcoin payment QR code" width={184} height={184} className="block h-[184px] w-[184px] rounded-xl" />
              : <div className="grid h-[184px] w-[184px] place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#8e8e93]" /></div>}
            {detected && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/85 backdrop-blur-[2px]">
                <CheckCircle2 className="h-11 w-11 text-emerald-500" strokeWidth={1.5} />
              </div>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="border-t border-[#f0f0f3] px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[#6e6e73]">Send exactly</span>
            <Segmented
              label="Amount unit"
              value={unit}
              onChange={setUnit}
              options={[{ id: 'btc', text: 'BTC' }, { id: 'sats', text: 'sats' }]}
            />
          </div>
          <button
            type="button"
            onClick={() => copy('amt', amountText)}
            aria-label="Copy amount"
            className="group mt-4 flex w-full items-center justify-between gap-4 text-left"
          >
            <span className="pay-mono min-w-0 break-all text-[22px] font-medium tracking-[-0.02em] tabular-nums">
              {unit === 'sats' ? fmtSats(amountSats) : amountBtc}
              <span className="ml-2 text-[14px] font-normal tracking-normal text-[#6e6e73]">{unit === 'btc' ? 'BTC' : 'sats'}</span>
            </span>
            <CopyChip done={copied === 'amt'} />
          </button>
          <p className="mt-2 text-[13px] text-[#6e6e73]">
            {inv.partial ? 'Remaining balance. ' : `About ${money(inv.usd)}. `}1 BTC = {rateText(inv.rateUsd)}
          </p>
        </div>

        {/* Address */}
        <div className="border-t border-[#f0f0f3] px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-[#6e6e73]">Bitcoin address</span>
            <button type="button" onClick={() => copy('addr', a)} aria-label="Copy address" className="group">
              <CopyChip done={copied === 'addr'} />
            </button>
          </div>
          <p className="pay-mono mt-4 select-all break-all text-[14px] leading-[1.9]">
            {parts.map((c, i, arr) => {
              const edge = i < 2 || i >= arr.length - 2;
              return <span key={i} className={`mr-2 inline-block ${edge ? 'font-semibold text-[#1d1d1f]' : 'text-[#6e6e73]'}`}>{c}</span>;
            })}
          </p>
          <p className="mt-3 text-[13px] leading-5 text-[#6e6e73]">
            Before you confirm, check that your wallet shows an address starting with{' '}
            <span className="pay-mono font-medium text-[#1d1d1f]">{a.slice(0, 8)}</span> and ending with{' '}
            <span className="pay-mono font-medium text-[#1d1d1f]">{a.slice(-8)}</span>. If it does not, stop.
          </p>
        </div>

        {/* Status */}
        {detected ? (
          <div className="border-t border-[#f0f0f3] px-6 py-6">
            <div className="flex items-center justify-between gap-3 text-[14px]">
              <span className="inline-flex items-center gap-2 font-medium text-emerald-700" aria-live="polite">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Payment detected
              </span>
              <span className="tabular-nums text-[#6e6e73]">
                {inv.requiredConf > 0 ? `${inv.confirmations} of ${inv.requiredConf} confirmations` : 'Confirming'}
              </span>
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#f0f0f3]">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.max(6, confPct)}%` }} />
            </div>
            <p className="mt-4 text-[13px] leading-5 text-[#6e6e73]">
              Each confirmation takes about 10 minutes. You can close this page and we will finish automatically.
            </p>
            {tx && (
              <a href={tx} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex items-center gap-1 text-[13px] ${linkCls}`}>
                View transaction <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#f0f0f3] px-6 py-5 text-[14px]">
            <span className="inline-flex items-center gap-2.5" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className="pay-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Waiting for payment
            </span>
            <span className="text-[#6e6e73]">Price locked for <PriceLock expiresAt={inv.expiresAt} /></span>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <a href={inv.uri} onClick={openWallet} className={primaryBtn}>
          <Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} /> Open in wallet
        </a>
        <button type="button" onClick={refresh} disabled={busy} className={secondaryBtn}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} strokeWidth={1.75} /> I've paid, check now
        </button>
      </div>

      {noWallet && (
        <div className="mt-4 rounded-2xl bg-[#f5f5f7] px-5 py-4 text-[14px] leading-6" role="status">
          No wallet app opened. {inv.network !== 'mainnet'
            ? 'Wallet apps usually cannot open test-network links, so copy the address and amount above instead.'
            : 'Scan the QR code with a Bitcoin wallet app, or copy the address and amount above.'}
          <button type="button" onClick={() => copy('uri', inv.uri)} className={`mt-1 block text-[14px] ${linkCls}`}>
            {copied === 'uri' ? 'Copied' : 'Copy payment link'}
          </button>
        </div>
      )}

      <p className="mx-auto mt-6 max-w-[360px] text-center text-[13px] leading-5 text-[#6e6e73]">
        Send the exact amount, your wallet adds the network fee. On-chain Bitcoin only. Lightning is not supported.
      </p>
    </>
  );
}

/* Confirmed */
function ConfirmedCard({ inv, meta, next, copy, copied }) {
  const tx = txLink(inv);
  return (
    <div className="pay-receipt pt-4 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path className="pay-draw" d="M5.5 12.5l4.2 4.2L18.5 7.8" />
        </svg>
      </div>
      <h1 className="mt-8 text-[30px] font-semibold tracking-[-0.03em]">Payment confirmed</h1>
      <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-6 text-[#6e6e73]">
        {next ? 'Thank you. Your payment is confirmed. Press Continue when you are ready.' : 'Thank you. Your subscription is paid and your service is active.'}
      </p>

      <div className="pay-no-print mx-auto mt-8 flex max-w-[320px] flex-col gap-3">
        {next && <Link to={next} className={primaryBtn}>Continue</Link>}
        <button type="button" onClick={() => window.print()} className={secondaryBtn}>
          <Printer className="h-4 w-4" strokeWidth={1.75} /> Print or save receipt
        </button>
      </div>

      <dl className="mt-14 divide-y divide-[#f0f0f3] border-y border-[#f0f0f3] text-left">
        <Row k="Receipt for" v={`${meta.title}${inv.label ? `, ${inv.label}` : ''}`} />
        <Row k="Amount" v={`${money(inv.usd)} USD`} />
        <Row k="Bitcoin paid" v={`${inv.btc} BTC`} mono />
        <Row k="Rate used" v={`1 BTC = ${rateText(inv.rateUsd)}`} />
        <Row k="Network" v={inv.network === 'mainnet' ? 'Bitcoin mainnet' : `${inv.network} (test)`} />
        <Row k="Confirmed" v={when(inv.paidAt)} />
        <Row k="Invoice ID" v={inv.id} mono small action={<CopyBtn onClick={() => copy('id', inv.id)} done={copied === 'id'} />} />
        {inv.txid && (
          <Row
            k="Transaction"
            v={inv.txid}
            mono
            small
            action={tx && (
              <a href={tx} target="_blank" rel="noopener noreferrer" aria-label="View transaction" className="pay-no-print grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]">
                <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          />
        )}
      </dl>

      <p className="mt-6 text-[13px] leading-5 text-[#6e6e73]">Keep your invoice ID. We do not email receipts, so this page is your proof of payment.</p>
      <Link to="/" className={`pay-no-print mt-6 inline-block text-[14px] ${linkCls}`}>Back to PlanIt</Link>
    </div>
  );
}

/* Expired / Review / Rejected */
function ExpiredCard({ busy, requote, error, inv }) {
  return (
    <div className="pt-4 text-center">
      <IconBadge><Clock className="h-5 w-5 text-[#1d1d1f]" strokeWidth={1.75} /></IconBadge>
      <h1 className="mt-7 text-[26px] font-semibold tracking-[-0.03em]">This quote expired</h1>
      <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-6 text-[#6e6e73]">
        Bitcoin's price moves, so each quote is only held for a short time. <strong className="font-medium text-[#1d1d1f]">Nothing was charged.</strong> Get a fresh quote to continue.
      </p>
      <div className="mx-auto mt-8 max-w-[320px]">
        <button type="button" onClick={requote} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.75} />} Get a new quote
        </button>
      </div>
      {error && <p className="mt-4 text-[13px] text-red-600" role="alert">{error}</p>}
      <p className="mx-auto mt-12 max-w-[360px] border-t border-[#f0f0f3] pt-6 text-[13px] leading-5 text-[#6e6e73]">
        Already sent a payment to the old address? Do not send it again. It will be flagged for a person to review automatically. Keep invoice ID{' '}
        <span className="pay-mono text-[#1d1d1f]">{inv.id.slice(0, 8)}</span>.
      </p>
    </div>
  );
}

function ReviewCard({ inv, copy, copied }) {
  const tx = txLink(inv);
  return (
    <div className="pt-4 text-center">
      <IconBadge><LifeBuoy className="h-5 w-5 text-[#1d1d1f]" strokeWidth={1.75} /></IconBadge>
      <h1 className="mt-7 text-[26px] font-semibold tracking-[-0.03em]">We're reviewing your payment</h1>
      <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-6 text-[#6e6e73]">
        A payment arrived that does not exactly match this order. For example, it came after the quote expired, or it was a partial amount. A person will review it.{' '}
        <strong className="font-medium text-[#1d1d1f]">Please do not send it again.</strong>
      </p>
      <dl className="mt-10 divide-y divide-[#f0f0f3] border-y border-[#f0f0f3] text-left">
        <Row k="Invoice ID" v={inv.id} mono small action={<CopyBtn onClick={() => copy('id', inv.id)} done={copied === 'id'} />} />
        <Row k="Received so far" v={`${fmtSats(inv.seenSats)} sats`} mono />
        <Row k="Order total" v={`${fmtSats(inv.sats)} sats`} mono />
      </dl>
      {tx && (
        <a href={tx} target="_blank" rel="noopener noreferrer" className={`mt-6 inline-flex items-center gap-1 text-[14px] ${linkCls}`}>
          View your transaction <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
      <p className="mt-6 text-[13px] leading-5 text-[#6e6e73]">
        Questions? Email <a className={linkCls} href={`mailto:${SUPPORT_EMAIL}?subject=Payment%20review%20${inv.id.slice(0, 8)}`}>{SUPPORT_EMAIL}</a> with your invoice ID.
      </p>
    </div>
  );
}

function RejectedCard({ inv }) {
  return (
    <div className="pt-4 text-center">
      <IconBadge><XCircle className="h-5 w-5 text-red-500" strokeWidth={1.75} /></IconBadge>
      <h1 className="mt-7 text-[26px] font-semibold tracking-[-0.03em]">Payment not accepted</h1>
      <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-6 text-[#6e6e73]">
        This payment could not be accepted for this order. Please email{' '}
        <a className={linkCls} href={`mailto:${SUPPORT_EMAIL}?subject=Rejected%20payment%20${inv.id.slice(0, 8)}`}>{SUPPORT_EMAIL}</a>{' '}
        with invoice ID <span className="pay-mono text-[#1d1d1f]">{inv.id.slice(0, 8)}</span> and we will sort it out.
      </p>
    </div>
  );
}

/* Sheets */
function DetailsSheet({ inv, meta, copy, copied }) {
  return (
    <dl className="divide-y divide-[#f0f0f3]">
      <Row k="Item" v={`${meta.title}${inv.label ? `, ${inv.label}` : ''}`} />
      <Row k="Total" v={money(inv.usd)} />
      <Row k="Total in Bitcoin" v={`${inv.btc} BTC`} mono />
      <Row k="Exchange rate" v={`${rateText(inv.rateUsd)} per BTC`} />
      <Row k="Network fee" v="Paid by you, in your wallet" />
      <Row k="PlanIt fee" v="None, you pay the price shown" />
      <Row k="Confirmations" v={inv.requiredConf === 0 ? 'Instant' : `${inv.requiredConf} (about ${inv.requiredConf * 10} min)`} />
      <Row k="Created" v={when(inv.createdAt)} />
      <Row k="Invoice ID" v={inv.id} mono small action={<CopyBtn onClick={() => copy('id', inv.id)} done={copied === 'id'} />} />
    </dl>
  );
}

const HOW_TABS = [
  { id: 'phone', text: 'Phone', icon: Smartphone, steps: [
    'Open your Bitcoin wallet (for example Proton Wallet, Blue Wallet, Muun or Cash App) and tap Send.',
    'Tap the scan icon and point the camera at the QR code, or tap Open in wallet.',
    'Check that the address ends match and the amount equals what is shown.',
    'Confirm. This page switches to Payment detected within seconds.',
  ] },
  { id: 'exchange', text: 'Exchange', icon: Landmark, steps: [
    'In Coinbase, Kraken, Cash App, Strike or similar, choose Send or Withdraw, then Bitcoin (on-chain, not Lightning).',
    'Paste the address and enter the BTC amount. Use Copy on the page to avoid typos.',
    'Make sure the amount received equals the amount shown. If the exchange subtracts its fee from the amount, raise the withdrawal so the full amount arrives.',
    'Some exchanges hold withdrawals for review. If that takes longer than the timer, you may be asked to get a fresh quote, or we will review it manually.',
  ] },
  { id: 'desktop', text: 'Desktop', icon: Monitor, steps: [
    'In Sparrow, Electrum or Proton Wallet, choose Send.',
    'Paste the address and the amount. Turn off "subtract fee from amount".',
    'Pick a normal fee. A higher fee confirms faster, and very low fees can stall.',
    'Review the address ends, then sign and broadcast.',
  ] },
];

function HowSheet() {
  const [tab, setTab] = useState('phone');
  const cur = HOW_TABS.find((t) => t.id === tab);
  return (
    <div>
      <Segmented full tabs label="Payment method" value={tab} onChange={setTab} options={HOW_TABS} />
      <ol className="mt-8 space-y-6">
        {cur.steps.map((s, i) => (
          <li key={s} className="flex gap-4">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f5f5f7] text-[12px] font-medium tabular-nums text-[#6e6e73]">{i + 1}</span>
            <span className="text-[15px] leading-6 text-[#1d1d1f]">{s}</span>
          </li>
        ))}
      </ol>
      <Link to="/help#btc-how-to-pay" className={`mt-8 inline-flex items-center gap-1 text-[14px] ${linkCls}`}>Read the full guide</Link>
    </div>
  );
}

const SECURITY_ITEMS = [
  { icon: KeyRound, t: 'The server cannot spend funds', d: 'PlanIt’s server only holds a public, watch-only key. It can create receive addresses but can never move funds, so a server breach cannot drain the wallet.' },
  { icon: Fingerprint, t: 'A fresh address for every order', d: 'Each invoice gets its own never-used address, checked on the blockchain before it is shown to you.' },
  { icon: ShieldCheck, t: 'Price and address come from our server', d: 'Your browser never supplies an amount or address, so neither can be altered by the link you opened.' },
  { icon: EyeOff, t: 'Your email is encrypted, then erased', d: 'Stored with AES-256-GCM and wiped once your order is fulfilled. IP addresses are kept only as one-way hashes for abuse limits.' },
  { icon: Lock, t: 'No account, no card', d: 'Nothing to hack or leak. No card numbers, no saved payment method, no password.' },
];

function SecuritySheet({ integrity, active }) {
  return (
    <div>
      <ul className="space-y-6">
        {SECURITY_ITEMS.map(({ icon: I, t, d }) => (
          <li key={t} className="flex gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f5f5f7]"><I className="h-[18px] w-[18px] text-[#1d1d1f]" strokeWidth={1.75} /></span>
            <div>
              <div className="text-[15px] font-medium">{t}</div>
              <div className="mt-1 text-[14px] leading-6 text-[#6e6e73]">{d}</div>
            </div>
          </li>
        ))}
      </ul>

      {active && integrity?.checks?.length > 0 && (
        <div className="mt-10 border-t border-[#f0f0f3] pt-8">
          <h3 className="text-[15px] font-medium">Checks on this page</h3>
          <ul className="mt-4 space-y-3">
            {integrity.checks.map((c) => (
              <li key={c.id} className="flex gap-3 text-[14px] leading-6">
                {c.ok
                  ? <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
                  : <X className="mt-1 h-4 w-4 shrink-0 text-red-600" />}
                <span className={c.ok ? 'text-[#1d1d1f]' : 'text-red-700'}>{c.ok ? c.label : c.bad}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-5 text-[#6e6e73]">These run in your browser on the data this page received. They do not replace comparing the address in your own wallet.</p>
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-[#f5f5f7] px-5 py-4 text-[14px] leading-6">
        <strong className="font-medium">Stay safe from scams.</strong> Only pay the address shown on this page, on this website. If anyone messages you a different address for PlanIt, do not pay it. Bitcoin payments cannot be reversed.
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  { q: 'How long does it take?', a: 'Donations and small payments are accepted as soon as they appear on the network, usually within seconds. Larger orders wait for 1 or 2 confirmations, roughly 10 minutes each. The page shows live progress, and you can safely close it. We keep watching the blockchain.' },
  { q: 'Who pays the network fee?', a: 'You do, inside your wallet, on top of the amount shown. PlanIt does not add any fee. For faster confirmation choose a higher fee in your wallet.' },
  { q: 'I sent the wrong amount. What now?', a: 'Slightly under (within about 1%) is accepted. If you sent less than that, the page shows the remaining amount, so send the difference to the same address. If you sent more, you are still fine. Contact us if you want to discuss the overpayment.' },
  { q: 'I paid after the timer ran out.', a: 'Do not panic and do not pay twice. Late payments are flagged for a person to review, and the order is completed manually. Keep your invoice ID and email us if you do not hear back.' },
  { q: 'Can I pay with Lightning, PayPal or a card?', a: 'Not at the moment. PlanIt Payments accepts on-chain Bitcoin only.' },
  { q: 'Can I get a refund?', a: 'Bitcoin transactions cannot be reversed, so refunds are handled manually and case by case. Email us with your invoice ID.' },
];

function FaqSheet() {
  const [open, setOpen] = useState(-1);
  return (
    <div>
      <div className="divide-y divide-[#f0f0f3] border-y border-[#f0f0f3]">
        {FAQ_ITEMS.map((it, i) => {
          const on = open === i;
          return (
            <div key={it.q}>
              <button
                type="button"
                onClick={() => setOpen(on ? -1 : i)}
                aria-expanded={on}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="text-[15px] font-medium">{it.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#8e8e93] transition-transform duration-200 ${on ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className={`pb-5 text-[14px] leading-6 text-[#6e6e73] ${on ? 'visible' : 'invisible [transition:visibility_0s_linear_0.2s]'}`}>{it.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex flex-col gap-3 text-[14px]">
        <Link to="/help#btc-what-is-bitcoin" className={linkCls}>New to Bitcoin?</Link>
        <Link to="/help#btc-how-to-pay" className={linkCls}>How to pay PlanIt</Link>
        <Link to="/help#btc-pay-problems" className={linkCls}>Payment problems</Link>
      </div>
    </div>
  );
}
