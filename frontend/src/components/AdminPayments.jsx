import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Bell, CheckCircle, Clock, Copy, DollarSign, ExternalLink, Eye, Loader2, RefreshCw,
  Search, Send, Server, ShieldAlert, ShieldCheck, X, XCircle, Zap, Wallet, Activity, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Admin → Payments
 *
 * Talks to /api/payments/admin/* (all behind verifyAdmin).
 *   GET  /admin/list         invoices + revenue stats
 *   GET  /admin/health       wallet / chain / price / alert wiring / queue
 *   POST /admin/test-alert   fires a real test to Discord + ntfy (+ Slack)
 *   GET  /admin/:id          full detail + event timeline
 *   POST /admin/:id/recheck | /retry-fulfill | /resolve
 *
 * Demo admin accounts get canned data and never touch real invoices.
 */

const PURPOSES = {
  support:         'Donation',
  feature_request: 'Feature request',
  wl_setup:        'WL setup fee',
  wl_subscription: 'WL subscription',
};

const STATUS_STYLE = {
  pending:   'bg-neutral-100 text-neutral-600',
  detected:  'bg-sky-100 text-sky-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  expired:   'bg-neutral-100 text-neutral-500',
  review:    'bg-amber-100 text-amber-800',
  rejected:  'bg-red-100 text-red-700',
};

const usd = (cents) => `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const ago = (d) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const DEMO = {
  items: [
    { id: 'a'.repeat(32), purpose: 'wl_setup', label: 'The Grand Ballroom', status: 'review', usd: 299, usdCents: 29900, btc: '0.00199333', sats: 199333, seenSats: 120000, confirmations: 2, requiredConf: 2, network: 'mainnet', address: 'bc1qdemo000000000000000000000000000000demo0', createdAt: new Date(Date.now() - 3600e3), expiresAt: new Date(Date.now() - 1800e3), fulfillState: 'none', events: [{ at: new Date(Date.now() - 3000e3), type: 'review', detail: 'late/partial payment: 120000 of 199333 sats' }], txids: [] },
    { id: 'b'.repeat(32), purpose: 'support', label: '', status: 'confirmed', usd: 10, usdCents: 1000, btc: '0.00006667', sats: 6667, seenSats: 6667, confirmations: 3, requiredConf: 0, network: 'mainnet', address: 'bc1qdemo111111111111111111111111111111demo1', createdAt: new Date(Date.now() - 86400e3), fulfillState: 'done', events: [], txids: [] },
  ],
  stats: { confirmedUsdCents: 1000, confirmedCount: 1, confirmedSats: 6667, last30UsdCents: 1000, byStatus: { review: 1, confirmed: 1 }, byPurpose: { support: { usdCents: 1000, n: 1 } } },
  network: 'mainnet',
};
const DEMO_HEALTH = {
  configured: true, network: 'mainnet', encKeySet: true,
  chain: { ok: true, tip: 900000 }, price: { ok: true, usd: 98000 },
  alerts: { viaRouter: true, localDiscord: false, localNtfy: false },
  queue: { open: 0, overdueChecks: 0, review: 1, unfulfilled: 0 }, lastPaidAt: new Date(Date.now() - 86400e3), frontendUrlSet: true,
};

export default function AdminPayments({ isDemo = false }) {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [q, setQ] = useState('');
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(null);
  const [testing, setTesting] = useState(false);
  const qTimer = useRef(null);

  const load = useCallback(async (opts = {}) => {
    if (isDemo) { setData(DEMO); setHealth(DEMO_HEALTH); setLoading(false); return; }
    if (!opts.silent) setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (purpose) params.purpose = purpose;
      if (q.trim()) params.q = q.trim();
      const [list, h] = await Promise.all([
        api.get('/payments/admin/list', { params }),
        api.get('/payments/admin/health').catch(() => ({ data: null })),
      ]);
      setData(list.data);
      setHealth(h.data);
      setErr('');
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [isDemo, status, purpose, q]);

  // Debounce the search box, reload straight away for dropdowns.
  useEffect(() => {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => load(), q ? 350 : 0);
    return () => clearTimeout(qTimer.current);
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auto || isDemo) return undefined;
    const t = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(t);
  }, [auto, isDemo, load]);

  const sendTest = async () => {
    if (isDemo) { toast.success('Test alert sent (sandbox)'); return; }
    setTesting(true);
    try {
      const r = await api.post('/payments/admin/test-alert');
      const c = r.data.channels || {};
      if (r.data.via === 'router') {
        const mark = (b) => (b ? '✓' : '✗ not set');
        toast.success(`Sent via router — Discord ${mark(c.discord)} · ntfy ${mark(c.ntfy)} · Slack ${mark(c.slack)}`, { duration: 7000 });
      } else if (r.data.via === 'direct') {
        toast.success(`Sent directly — Discord ${c.discord ? '✓' : '✗'} · ntfy ${c.ntfy ? '✓' : '✗'}`, { duration: 6000 });
      } else {
        toast.error('No alert channel is configured. Set DISCORD_WEBHOOK_URL / NTFY_URL on the router.', { duration: 8000 });
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Test alert failed');
    } finally { setTesting(false); }
  };

  const stats = data?.stats;
  const reviewCount = stats?.byStatus?.review || 0;
  const unfulfilled = health?.queue?.unfulfilled || 0;
  const testMode = (data?.network || health?.network) && (data?.network || health?.network) !== 'mainnet';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Wallet className="w-5 h-5 text-amber-700" /></div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              Payments
              {data?.network && (
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${testMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                  {testMode ? `Test · ${data.network}` : 'Mainnet · live'}
                </span>
              )}
            </h2>
            <p className="text-xs text-neutral-500">Bitcoin invoices for donations, feature requests and White Label billing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer select-none">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="rounded" /> Auto-refresh
          </label>
          <button onClick={sendTest} disabled={testing} className="inline-flex items-center gap-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-60">
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />} Send test alert
          </button>
          <button onClick={() => load()} className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-3 py-2 text-xs font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5" /> {err}</div>}

      {/* Not configured */}
      {health && health.configured === false && !isDemo && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-bold text-red-800"><ShieldAlert className="w-4 h-4" /> Payments are NOT active on this backend</div>
          <p className="text-sm text-red-700 mt-1">{health.configError || 'BTC_XPUB / BTC_NETWORK are not set.'}</p>
          <p className="text-xs text-red-600 mt-2">Set <code>BTC_XPUB</code>, <code>BTC_NETWORK</code> and <code>PAYMENTS_ENC_KEY</code> on the <strong>router</strong>, then restart the backends. See docs/PAYMENTS.md.</p>
        </div>
      )}

      {/* Action needed banners */}
      {(reviewCount > 0 || unfulfilled > 0) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            {reviewCount > 0 && <span><strong>{reviewCount}</strong> payment{reviewCount > 1 ? 's' : ''} need{reviewCount === 1 ? 's' : ''} your review.</span>}
            {unfulfilled > 0 && <span><strong>{unfulfilled}</strong> confirmed payment{unfulfilled > 1 ? 's' : ''} not yet fulfilled.</span>}
          </div>
          {reviewCount > 0 && <button onClick={() => { setStatus('review'); setPurpose(''); setQ(''); }} className="text-xs font-semibold text-amber-900 underline underline-offset-2">Show review queue</button>}
        </div>
      )}

      {/* Revenue stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Received (all time)" value={usd(stats?.confirmedUsdCents)} sub={`${stats?.confirmedCount || 0} confirmed`} tone="emerald" />
        <Stat icon={Activity} label="Last 30 days" value={usd(stats?.last30UsdCents)} sub={testMode ? 'test coins' : 'confirmed revenue'} tone="blue" />
        <Stat icon={Inbox} label="Needs review" value={reviewCount} sub="late / partial / odd" tone={reviewCount ? 'amber' : 'neutral'} onClick={reviewCount ? () => setStatus('review') : undefined} />
        <Stat icon={Zap} label="Open right now" value={health?.queue?.open ?? (stats?.byStatus?.pending || 0) + (stats?.byStatus?.detected || 0)} sub="waiting to be paid" tone="neutral" />
      </div>

      {stats?.byPurpose && Object.keys(stats.byPurpose).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.byPurpose).map(([k, v]) => (
            <button key={k} onClick={() => setPurpose(purpose === k ? '' : k)}
              className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${purpose === k ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}>
              {PURPOSES[k] || k}: <strong>{usd(v.usdCents)}</strong> <span className="opacity-60">· {v.n}</span>
            </button>
          ))}
        </div>
      )}

      {/* Health */}
      {health && health.configured !== undefined && <HealthStrip h={health} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice ID, address or business…"
            className="w-full border border-neutral-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-neutral-200 rounded-xl px-3 py-2 text-xs bg-white">
          <option value="">All statuses</option>
          {Object.keys(STATUS_STYLE).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="border border-neutral-200 rounded-xl px-3 py-2 text-xs bg-white">
          <option value="">All types</option>
          {Object.entries(PURPOSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(status || purpose || q) && <button onClick={() => { setStatus(''); setPurpose(''); setQ(''); }} className="text-xs text-neutral-500 underline">Clear</button>}
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-400 border-b border-neutral-100 bg-neutral-50/60">
                <th className="px-4 py-2.5 font-semibold">Created</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Conf.</th>
                <th className="px-4 py-2.5 font-semibold">Fulfilled</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading && !data && <tr><td colSpan={7} className="py-12 text-center text-neutral-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>}
              {data?.items?.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-neutral-400">No payments match.</td></tr>}
              {data?.items?.map((i) => (
                <tr key={i.id} onClick={() => setSelected(i)} className="border-b border-neutral-50 hover:bg-neutral-50 cursor-pointer">
                  <td className="px-4 py-3 whitespace-nowrap"><div className="text-neutral-800">{dt(i.createdAt)}</div><div className="text-[10px] text-neutral-400">{ago(i.createdAt)}</div></td>
                  <td className="px-4 py-3"><div className="font-medium text-neutral-800">{PURPOSES[i.purpose] || i.purpose}</div>{i.label && <div className="text-[10px] text-neutral-400 truncate max-w-[180px]">{i.label}</div>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap"><div className="font-semibold text-neutral-900">{usd(i.usdCents)}</div><div className="text-[10px] font-mono text-neutral-400">{i.btc} BTC</div></td>
                  <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[i.status] || STATUS_STYLE.pending}`}>{i.status}</span></td>
                  <td className="px-4 py-3 text-neutral-600">{i.confirmations}/{i.requiredConf}</td>
                  <td className="px-4 py-3">{i.status !== 'confirmed' ? <span className="text-neutral-300">—</span> : i.fulfillState === 'done' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <span className="text-amber-600 font-semibold">{i.fulfillState === 'running' ? 'running' : 'pending'}</span>}</td>
                  <td className="px-4 py-3 text-right"><Eye className="w-4 h-4 text-neutral-400 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <InvoiceDrawer
          invoice={selected}
          isDemo={isDemo}
          onClose={() => setSelected(null)}
          onChanged={(fresh) => { if (fresh) setSelected(fresh); load({ silent: true }); }}
        />
      )}
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────── */

function Stat({ icon: Icon, label, value, sub, tone = 'neutral', onClick }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700', neutral: 'bg-neutral-100 text-neutral-600',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`text-left bg-white border border-neutral-200 rounded-2xl p-4 ${onClick ? 'hover:border-neutral-400 transition-colors' : ''}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tones[tone]}`}><Icon className="w-4 h-4" /></div>
      <div className="text-xl font-bold text-neutral-900">{value}</div>
      <div className="text-[11px] font-medium text-neutral-500 mt-0.5">{label}</div>
      <div className="text-[10px] text-neutral-400">{sub}</div>
    </Tag>
  );
}

function Pill({ ok, warn, label, detail }) {
  const cls = ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : warn ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-800';
  const Icon = ok ? CheckCircle : warn ? AlertTriangle : XCircle;
  return (
    <div className={`flex items-start gap-2 border rounded-xl px-3 py-2 ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0"><div className="text-xs font-semibold">{label}</div>{detail && <div className="text-[10px] opacity-80 break-words">{detail}</div>}</div>
    </div>
  );
}

function HealthStrip({ h }) {
  const [open, setOpen] = useState(false);
  const problems = useMemo(() => {
    const p = [];
    if (!h.configured) p.push('wallet');
    if (h.configured && h.chain && !h.chain.ok) p.push('chain');
    if (h.configured && h.price && !h.price.ok) p.push('price');
    if (h.encKeySet === false) p.push('enckey');
    if (h.alerts && !h.alerts.viaRouter && !h.alerts.localDiscord && !h.alerts.localNtfy) p.push('alerts');
    if (h.queue?.overdueChecks > 0) p.push('watcher');
    return p;
  }, [h]);

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          {problems.length === 0 ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-amber-600" />}
          System health
          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${problems.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
            {problems.length === 0 ? 'all good' : `${problems.length} to check`}
          </span>
        </span>
        <span className="text-[11px] text-neutral-400">{open ? 'hide' : 'details'}</span>
      </button>
      {(open || problems.length > 0) && (
        <div className="px-4 pb-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <Pill ok={h.configured} label="Wallet key" detail={h.configured ? `Watch-only key loaded (${h.network})` : (h.configError || 'Not configured')} />
          <Pill ok={h.encKeySet} warn={!h.encKeySet} label="PII encryption key" detail={h.encKeySet ? 'PAYMENTS_ENC_KEY is set' : 'Missing or not 64 hex chars'} />
          <Pill ok={h.chain?.ok} label="Blockchain lookups" detail={h.chain?.ok ? `Tip height ${Number(h.chain.tip).toLocaleString()}` : (h.chain?.error || 'n/a')} />
          <Pill ok={h.price?.ok} label="BTC/USD price" detail={h.price?.ok ? `$${Number(h.price.usd).toLocaleString()}${h.testRateActive ? ' (fixed test rate)' : ''}` : (h.price?.error || 'n/a')} />
          <Pill ok={h.alerts?.viaRouter || h.alerts?.localDiscord || h.alerts?.localNtfy}
            label="Alerts (Discord / ntfy)"
            detail={h.alerts?.viaRouter ? 'Routed through the router — use “Send test alert” to confirm channels' : h.alerts?.localDiscord || h.alerts?.localNtfy ? 'Direct from this backend' : 'No ROUTER_URL, DISCORD_WEBHOOK_URL or NTFY_URL'} />
          <Pill ok={!(h.queue?.overdueChecks > 0)} warn label="Chain watcher" detail={h.queue?.overdueChecks > 0 ? `${h.queue.overdueChecks} open invoice(s) overdue for a check` : `${h.queue?.open || 0} open · last payment ${h.lastPaidAt ? ago(h.lastPaidAt) : 'never'}`} />
        </div>
      )}
    </div>
  );
}

function InvoiceDrawer({ invoice, isDemo, onClose, onChanged }) {
  const [inv, setInv] = useState(invoice);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setInv(invoice);
    if (isDemo) return;
    api.get(`/payments/admin/${invoice.id}`).then((r) => setInv(r.data)).catch(() => {});
  }, [invoice, isDemo]);

  const run = async (key, fn, okMsg) => {
    if (isDemo) { toast.success(`${okMsg} (sandbox)`); return; }
    setBusy(key);
    try { const r = await fn(); toast.success(okMsg); return r; }
    catch (e) { toast.error(e?.response?.data?.message || e?.response?.data?.error || 'Action failed'); }
    finally { setBusy(''); }
  };

  const recheck = async () => {
    const r = await run('recheck', () => api.post(`/payments/admin/${inv.id}/recheck`), 'Chain re-checked');
    if (r?.data) { setInv(r.data); onChanged(r.data); }
  };
  const retry = async () => {
    const r = await run('retry', () => api.post(`/payments/admin/${inv.id}/retry-fulfill`), 'Fulfilment re-run');
    if (r?.data?.invoice) { setInv(r.data.invoice); onChanged(r.data.invoice); }
  };
  const resolve = async (action) => {
    const msg = action === 'accept'
      ? 'Accept this payment?\n\nOnly do this after you have checked the funds really arrived in your wallet. This marks the invoice paid and fulfils the order.'
      : 'Reject this payment? The order will NOT be fulfilled. Refund (if any) is manual.';
    if (!window.confirm(msg)) return;
    const r = await run(action, () => api.post(`/payments/admin/${inv.id}/resolve`, { action, note }), action === 'accept' ? 'Payment accepted' : 'Payment rejected');
    if (r) { onChanged(null); onClose(); }
  };
  const copy = (t, label) => { navigator.clipboard?.writeText(t).then(() => toast.success(`${label} copied`)).catch(() => {}); };

  const canResolve = ['review', 'expired', 'pending', 'detected'].includes(inv.status);
  const payLink = `${window.location.origin}/pay/${inv.id}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Invoice detail">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-neutral-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-sm font-bold text-neutral-900">{PURPOSES[inv.purpose] || inv.purpose} · {usd(inv.usdCents)}</div>
            <div className="text-[11px] text-neutral-400 font-mono">{inv.id.slice(0, 12)}…</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${STATUS_STYLE[inv.status]}`}>{inv.status}</span>
            {inv.status === 'confirmed' && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${inv.fulfillState === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>fulfilment: {inv.fulfillState}{inv.fulfillTries ? ` (${inv.fulfillTries} tries)` : ''}</span>}
            <span className="text-[11px] text-neutral-400">{inv.network}</span>
          </div>

          {inv.status === 'review' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <strong>Needs a decision.</strong> Received <strong>{(inv.seenSats || 0).toLocaleString()}</strong> of <strong>{(inv.sats || 0).toLocaleString()}</strong> sats.
              Open the address in the explorer and check your wallet before accepting.
            </div>
          )}

          <dl className="text-xs divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
            <D k="Amount" v={`${usd(inv.usdCents)} · ${inv.btc} BTC`} />
            <D k="Rate locked" v={inv.rateUsd ? `$${Number(inv.rateUsd).toLocaleString()} / BTC` : '—'} />
            <D k="Seen / confirmed" v={`${(inv.seenSats || 0).toLocaleString()} / ${(inv.confirmedSats || 0).toLocaleString()} sats`} />
            <D k="Confirmations" v={`${inv.confirmations} of ${inv.requiredConf} required`} />
            {inv.label && <D k="Label" v={inv.label} />}
            {inv.emailHint && <D k="Buyer" v={inv.emailHint} />}
            <D k="Created" v={dt(inv.createdAt)} />
            <D k="Quote expires" v={dt(inv.expiresAt)} />
            {inv.paidAt && <D k="Paid" v={dt(inv.paidAt)} />}
            <D k="Last chain check" v={inv.lastCheckedAt ? ago(inv.lastCheckedAt) : '—'} />
            <D k="Address" v={inv.address} mono action={<><Ic onClick={() => copy(inv.address, 'Address')}><Copy className="w-3.5 h-3.5" /></Ic>{inv.addressUrl && <a href={inv.addressUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-400 hover:text-neutral-800"><ExternalLink className="w-3.5 h-3.5" /></a>}</>} />
            {(inv.txids || []).map((t, n) => (
              <D key={t} k={n === 0 ? 'Transaction' : `Tx ${n + 1}`} v={t} mono action={<><Ic onClick={() => copy(t, 'TXID')}><Copy className="w-3.5 h-3.5" /></Ic>{n === 0 && inv.txUrl && <a href={inv.txUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-400 hover:text-neutral-800"><ExternalLink className="w-3.5 h-3.5" /></a>}</>} />
            ))}
            <D k="Pay link" v={payLink} mono action={<Ic onClick={() => copy(payLink, 'Pay link')}><Copy className="w-3.5 h-3.5" /></Ic>} />
          </dl>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {['pending', 'detected', 'expired', 'review'].includes(inv.status) && (
                <Btn onClick={recheck} busy={busy === 'recheck'} icon={RefreshCw}>Re-check chain now</Btn>
              )}
              {inv.status === 'confirmed' && inv.fulfillState !== 'done' && (
                <Btn onClick={retry} busy={busy === 'retry'} icon={Send} tone="amber">Retry fulfilment</Btn>
              )}
              <a href={payLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border border-neutral-200 hover:bg-neutral-50 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-700"><ExternalLink className="w-3.5 h-3.5" /> Open pay page</a>
            </div>

            {canResolve && (
              <div className="rounded-xl border border-neutral-200 p-3 space-y-2">
                <div className="text-xs font-semibold text-neutral-800">Manual resolution</div>
                <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 150))} placeholder="Note (e.g. “confirmed in Proton, txid abc…”)"
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                <div className="flex gap-2">
                  <Btn onClick={() => resolve('accept')} busy={busy === 'accept'} icon={CheckCircle} tone="green">Accept payment</Btn>
                  <Btn onClick={() => resolve('reject')} busy={busy === 'reject'} icon={XCircle} tone="red">Reject</Btn>
                </div>
                <p className="text-[10px] text-neutral-400">Accept marks it paid and runs fulfilment exactly once. Verify the money in your wallet first.</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <div className="text-xs font-semibold text-neutral-800 mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Timeline</div>
            {(inv.events || []).length === 0 ? <p className="text-xs text-neutral-400">No events.</p> : (
              <ol className="relative border-l border-neutral-200 ml-1.5 space-y-3">
                {[...inv.events].reverse().map((e, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-neutral-300" />
                    <div className="text-xs font-semibold text-neutral-800">{e.type.replace(/_/g, ' ')}</div>
                    {e.detail && <div className="text-[11px] text-neutral-500 break-words">{e.detail}</div>}
                    <div className="text-[10px] text-neutral-400">{dt(e.at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const D = ({ k, v, mono, action }) => (
  <div className="flex items-start justify-between gap-3 px-3 py-2">
    <dt className="text-neutral-400 shrink-0">{k}</dt>
    <dd className={`text-right text-neutral-800 min-w-0 break-all flex items-center gap-1 justify-end ${mono ? 'font-mono text-[10px]' : ''}`}><span className="min-w-0">{v}</span>{action}</dd>
  </div>
);
const Ic = ({ children, onClick }) => <button onClick={onClick} className="p-1 text-neutral-400 hover:text-neutral-800">{children}</button>;
function Btn({ children, onClick, busy, icon: Icon, tone = 'dark' }) {
  const tones = {
    dark: 'bg-neutral-900 hover:bg-neutral-800 text-white', amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    green: 'bg-emerald-600 hover:bg-emerald-700 text-white', red: 'border border-red-200 text-red-700 hover:bg-red-50',
  };
  return (
    <button onClick={onClick} disabled={!!busy} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60 ${tones[tone]}`}>
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />} {children}
    </button>
  );
}
