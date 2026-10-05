import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import QRCode from 'qrcode';
import axios from 'axios';
import { io } from 'socket.io-client';

/**
 * PlanIt Payments — Bitcoin pay page (/pay/:id)
 *
 * The invoice id in the URL is a 128-bit random value and is the only
 * credential needed to view the page. The browser never sends an amount or an
 * address anywhere; it only displays what the server issued.
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

const successUrl = (inv) => {
  if (inv.purpose === 'support')         return `/support/success?invoice=${inv.id}`;
  if (inv.purpose === 'feature_request') return `/support/success?invoice=${inv.id}&type=feature`;
  if (inv.purpose === 'wl_setup')        return `/white-label/setup-success?invoice=${inv.id}`;
  return null; // subscription: stay here and show the receipt
};

const chunk = (addr) => addr.replace(/(.{4})/g, '$1 ').trim();
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const explorer = (inv) => {
  if (!inv?.txid) return null;
  const prefix = inv.network === 'mainnet' ? '' : `${inv.network}/`;
  return `https://mempool.space/${prefix}tx/${inv.txid}`;
};

export default function Pay() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const [inv, setInv] = useState(null);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState('');
  const [busy, setBusy] = useState(false);
  const redirected = useRef(false);

  useEffect(() => { document.title = 'Pay with Bitcoin — PlanIt'; }, []);

  // ── Load + live updates (socket for speed, polling as the safety net) ──────
  const load = useCallback(async () => {
    try {
      const r = await api.get(`/payments/${id}`);
      setInv(r.data);
      setError('');
    } catch (e) {
      if (e?.response?.status === 404) setError('This payment link is not valid.');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let sock;
    try {
      sock = io(`${WS_URL}/pay`, { transports: ['polling', 'websocket'], reconnectionDelayMax: 15000 });
      sock.on('connect', () => sock.emit('invoice:join', id));
      sock.on('invoice:update', (v) => { if (v?.id === id) setInv(v); });
    } catch { /* polling still works */ }
    return () => { try { sock?.disconnect(); } catch { /* noop */ } };
  }, [id]);

  const active = inv && ['pending', 'detected'].includes(inv.status);
  useEffect(() => {
    const t = setInterval(load, active ? 5000 : 20000);
    return () => clearInterval(t);
  }, [load, active]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // ── QR code (generated locally — the address never leaves the browser) ────
  useEffect(() => {
    if (!inv?.uri) return;
    QRCode.toDataURL(inv.uri, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, [inv?.uri]);

  // ── Redirect on success ───────────────────────────────────────────────────
  useEffect(() => {
    if (inv?.status === 'confirmed' && !redirected.current) {
      const to = successUrl(inv);
      if (to) { redirected.current = true; const t = setTimeout(() => navigate(to), 1800); return () => clearTimeout(t); }
    }
  }, [inv, navigate]);

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  const refresh = async () => {
    setBusy(true);
    try { const r = await api.post(`/payments/${id}/refresh`); setInv(r.data); } catch { /* ignore */ }
    setBusy(false);
  };

  const requote = async () => {
    setBusy(true);
    try {
      const r = await api.post(`/payments/${id}/requote`);
      redirected.current = false;
      navigate(`/pay/${r.data.id}${search ? `?${search.toString()}` : ''}`, { replace: true });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not create a new quote. Please try again.');
    }
    setBusy(false);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  if (error && !inv) {
    return (
      <Shell>
        <div className="text-center py-16">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <p className="text-neutral-700 mb-6">{error}</p>
          <Link to="/support" className="text-sm text-blue-600">← Back</Link>
        </div>
      </Shell>
    );
  }
  if (!inv) {
    return <Shell><div className="py-24 text-center text-neutral-400 text-sm"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />Loading payment…</div></Shell>;
  }

  const remainingMs = new Date(inv.expiresAt).getTime() - now;
  const testnet = inv.network !== 'mainnet';
  const amountBtc = inv.partial ? inv.remainingBtc : inv.btc;

  return (
    <Shell>
      {testnet && (
        <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
          <strong>Test mode ({inv.network}).</strong> These are test coins with no real value.
        </div>
      )}

      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-xl font-bold text-neutral-900">Pay with Bitcoin</h1>
        <div className="text-right">
          <div className="text-lg font-bold text-neutral-900">${inv.usd.toFixed(2)}</div>
          {inv.label && <div className="text-xs text-neutral-500">{inv.label}</div>}
        </div>
      </div>

      {/* ── CONFIRMED ── */}
      {inv.status === 'confirmed' && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">Payment confirmed</h2>
          <p className="text-sm text-neutral-600 mb-4">Thank you! {successUrl(inv) ? 'Taking you to your receipt…' : 'Your subscription is paid.'}</p>
          {explorer(inv) && <a href={explorer(inv)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">View transaction ↗</a>}
        </div>
      )}

      {/* ── WAITING / DETECTED ── */}
      {active && (
        <>
          <p className="text-sm text-neutral-500 mb-5">
            {inv.status === 'detected'
              ? 'Payment seen on the network — waiting for confirmation.'
              : 'Scan with any Bitcoin wallet, or copy the details below.'}
          </p>

          {inv.partial && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2">
              We received part of your payment. Please send the remaining <strong>{inv.remainingBtc} BTC</strong> to the same address.
            </div>
          )}

          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-xl border border-neutral-200">
              {qr ? <img src={qr} alt="Bitcoin payment QR code" width={220} height={220} /> : <div className="w-[220px] h-[220px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-neutral-300" /></div>}
            </div>
            <a href={inv.uri} className="mt-4 inline-flex items-center gap-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg px-4 py-2.5 hover:bg-neutral-800">
              <Wallet className="w-4 h-4" /> Open in wallet app
            </a>
          </div>

          <div className="mt-6 space-y-3">
            <Field label="Amount (BTC)" value={amountBtc} onCopy={() => copy('amt', amountBtc)} done={copied === 'amt'} mono />
            <Field label="Address" value={chunk(inv.address)} onCopy={() => copy('addr', inv.address)} done={copied === 'addr'} mono small />
          </div>

          <div className="mt-5 flex items-center justify-between text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {remainingMs > 0 ? <>Price locked for <strong className="text-neutral-800">{fmt(remainingMs)}</strong></> : 'Quote expiring…'}
            </span>
            <span>1 BTC ≈ ${Number(inv.rateUsd).toLocaleString()}</span>
          </div>

          <div className="mt-4 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-3 text-xs text-neutral-600 space-y-1.5">
            {inv.status === 'detected' ? (
              <div className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />
                Confirmations: <strong>{inv.confirmations}</strong> / {inv.requiredConf} — usually 10–20 minutes per confirmation.</div>
            ) : (
              <div className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for your payment…</div>
            )}
            <div>Send exactly the amount shown. Your wallet adds the network fee on top.</div>
          </div>

          <button onClick={refresh} disabled={busy} className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-neutral-300 rounded-lg py-2.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> I've paid — check now
          </button>
        </>
      )}

      {/* ── EXPIRED ── */}
      {inv.status === 'expired' && (
        <div className="text-center py-10">
          <Clock className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">This quote expired</h2>
          <p className="text-sm text-neutral-600 mb-5">Bitcoin's price moves, so quotes are only held for a short time. Nothing was charged — get a fresh quote to continue.</p>
          <button onClick={requote} disabled={busy} className="inline-flex items-center gap-2 bg-neutral-900 text-white text-sm font-semibold rounded-lg px-5 py-2.5 hover:bg-neutral-800 disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Get a new quote
          </button>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      )}

      {/* ── REVIEW ── */}
      {inv.status === 'review' && (
        <div className="text-center py-10">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">We're checking your payment</h2>
          <p className="text-sm text-neutral-600 mb-4">A payment arrived that doesn't exactly match this order (for example, it came after the quote expired or was a partial amount). A person will review it — <strong>please don't send it again</strong>. Keep this page's link for reference.</p>
          {explorer(inv) && <a href={explorer(inv)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">View transaction ↗</a>}
        </div>
      )}

      {inv.status === 'rejected' && (
        <div className="text-center py-10">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">Payment not accepted</h2>
          <p className="text-sm text-neutral-600">This payment could not be accepted. Please contact us with this link.</p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-neutral-100 flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-neutral-400" />
        <span>Payments go straight to PlanIt's wallet — no account, no card details. This address is unique to your order and the server holds no keys that can spend funds. Your email is encrypted at rest.</span>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-neutral-200">
        <div className="max-w-xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-neutral-900">PlanIt</Link>
          <span className="text-xs text-neutral-400">Secure checkout</span>
        </div>
      </header>
      <main className="max-w-md mx-auto px-5 py-8">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">{children}</div>
      </main>
    </div>
  );
}

function Field({ label, value, onCopy, done, mono, small }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">{label}</div>
      <div className="flex items-stretch gap-2">
        <div className={`flex-1 min-w-0 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 break-all text-neutral-900 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'}`}>{value}</div>
        <button onClick={onCopy} className="px-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600" aria-label={`Copy ${label}`}>
          {done ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
