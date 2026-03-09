import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Server, Database, Globe, Activity, Zap, Shield, TrendingUp,
  Users, Calendar, MessageSquare, LogOut, Wifi, Cpu, HardDrive,
  BarChart3, RefreshCw, Layers, GitBranch, Radio, Terminal,
  Cloud, Network, Lock, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import {
  getDemoStats, getDemoFleet, getDemoSystem, getLiveFeed,
  getDemoScaling, DATA_CENTERS,
} from '../services/demoData';

// ── Utilities ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtBytes(b) {
  if (b >= 1e15) return (b / 1e15).toFixed(1) + ' PB';
  if (b >= 1e12) return (b / 1e12).toFixed(1) + ' TB';
  if (b >= 1e9)  return (b / 1e9).toFixed(1)  + ' GB';
  return (b / 1e6).toFixed(0) + ' MB';
}
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  return `${d}d ${h}h`;
}

// ── Animated counter ──────────────────────────────────────────────────────────

function Counter({ value, format = fmt, className = '' }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const diff = value - prev.current;
    if (Math.abs(diff) < 2) { setDisplay(value); return; }
    let start = null;
    const dur = 600;
    const from = prev.current;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + diff * ease));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    prev.current = value;
  }, [value]);
  return <span className={className}>{format(display)}</span>;
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────

function PulseDot({ color = 'emerald', size = 2 }) {
  return (
    <span className="relative flex" style={{ width: size * 4, height: size * 4 }}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color}-400 opacity-60`} />
      <span className={`relative inline-flex rounded-full bg-${color}-500`} style={{ width: size * 4, height: size * 4 }} />
    </span>
  );
}

// ── Mini spark bar ────────────────────────────────────────────────────────────

function SparkBars({ values, color = '#22d3ee', height = 32 }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-px" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all duration-300"
          style={{ height: `${Math.max(4, (v / max) * height)}px`, background: color, opacity: 0.6 + (i / values.length) * 0.4 }}
        />
      ))}
    </div>
  );
}

// ── World map SVG (simplified) ────────────────────────────────────────────────
// Projects lat/lng to SVG coordinates using equirectangular projection

function WorldMap({ dataCenters }) {
  const W = 800, H = 380;
  function project(lat, lng) {
    const x = (lng + 180) * (W / 360);
    const y = (90 - lat) * (H / 180);
    return { x, y };
  }

  const tierColor = { primary: '#22d3ee', secondary: '#818cf8', edge: '#34d399' };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ filter: 'drop-shadow(0 0 20px rgba(34,211,238,0.15))' }}>
      {/* Ocean */}
      <rect width={W} height={H} fill="#060d1a" rx="8" />
      {/* Very rough continent outlines as paths (simplified polygons) */}
      <g fill="#0f2236" stroke="#1a3a5c" strokeWidth="0.5" opacity="0.8">
        {/* North America */}
        <polygon points="80,60 160,50 200,70 220,130 200,180 170,200 130,190 100,160 70,120 60,90" />
        {/* South America */}
        <polygon points="150,200 200,195 230,220 240,280 220,330 190,350 160,330 140,290 130,250 140,220" />
        {/* Europe */}
        <polygon points="340,55 390,50 420,60 430,90 410,110 380,120 350,110 330,90 330,70" />
        {/* Africa */}
        <polygon points="350,120 420,110 450,140 460,200 450,260 420,310 380,330 340,310 320,260 315,200 330,150" />
        {/* Asia */}
        <polygon points="430,40 550,30 660,50 720,80 740,130 700,160 640,170 560,160 490,140 440,110 420,80" />
        {/* India */}
        <polygon points="500,130 550,125 570,160 560,210 530,230 500,210 480,180 480,155" />
        {/* Southeast Asia */}
        <polygon points="610,140 660,130 690,155 680,185 650,190 620,175 600,160" />
        {/* Australia */}
        <polygon points="620,230 700,220 740,245 750,290 720,320 660,325 610,300 600,265 610,245" />
        {/* UK/Ireland */}
        <polygon points="335,58 350,53 358,62 348,75 334,72" />
      </g>
      {/* Grid lines */}
      {[-60,-30,0,30,60].map(lat => {
        const y = (90 - lat) * (H / 180);
        return <line key={lat} x1="0" y1={y} x2={W} y2={y} stroke="#0f2236" strokeWidth="0.5" />;
      })}
      {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lng => {
        const x = (lng + 180) * (W / 360);
        return <line key={lng} x1={x} y1="0" x2={x} y2={H} stroke="#0f2236" strokeWidth="0.5" />;
      })}
      {/* Connection arcs between primary DCs */}
      {dataCenters.filter(dc => dc.tier === 'primary').map((dc, i, arr) => {
        if (i === 0) return null;
        const a = project(arr[0].lat, arr[0].lng);
        const b = project(dc.lat, dc.lng);
        const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - 40;
        return (
          <path key={dc.id} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
            stroke="#22d3ee" strokeWidth="0.5" fill="none" opacity="0.2" strokeDasharray="4,4" />
        );
      })}
      {/* Data center nodes */}
      {dataCenters.map(dc => {
        const { x, y } = project(dc.lat, dc.lng);
        const col = tierColor[dc.tier] || '#22d3ee';
        const r = dc.tier === 'primary' ? 6 : dc.tier === 'secondary' ? 5 : 4;
        return (
          <g key={dc.id}>
            <circle cx={x} cy={y} r={r * 2.5} fill={col} opacity="0.08" />
            <circle cx={x} cy={y} r={r * 1.5} fill={col} opacity="0.15" />
            <circle cx={x} cy={y} r={r} fill={col} opacity="0.9" />
            <circle cx={x} cy={y} r={r} fill="none" stroke={col} strokeWidth="1" opacity="0.5">
              <animate attributeName="r" from={r} to={r * 3} dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, accent = 'cyan', badge, large }) {
  const colors = {
    cyan:   { ring: 'ring-cyan-500/20',   icon: 'text-cyan-400',   bg: 'bg-cyan-500/10',   val: 'text-cyan-300'   },
    purple: { ring: 'ring-purple-500/20', icon: 'text-purple-400', bg: 'bg-purple-500/10', val: 'text-purple-300' },
    green:  { ring: 'ring-green-500/20',  icon: 'text-green-400',  bg: 'bg-green-500/10',  val: 'text-green-300'  },
    amber:  { ring: 'ring-amber-500/20',  icon: 'text-amber-400',  bg: 'bg-amber-500/10',  val: 'text-amber-300'  },
    rose:   { ring: 'ring-rose-500/20',   icon: 'text-rose-400',   bg: 'bg-rose-500/10',   val: 'text-rose-300'   },
    indigo: { ring: 'ring-indigo-500/20', icon: 'text-indigo-400', bg: 'bg-indigo-500/10', val: 'text-indigo-300' },
  };
  const c = colors[accent] || colors.cyan;
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 ring-1 ${c.ring} hover:bg-white/[0.05] transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-bold tracking-tight ${c.val} ${large ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── DB Replica status ─────────────────────────────────────────────────────────

function ReplicaRow({ member }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2">
        <PulseDot color={member.state === 'PRIMARY' ? 'emerald' : 'sky'} size={1.5} />
        <span className="text-xs font-mono text-neutral-300">{member.name}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${member.state === 'PRIMARY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-sky-500/15 text-sky-400'}`}>
          {member.state}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs font-mono">
        <span className="text-neutral-500">{member.region}</span>
        {member.lag > 0 && <span className="text-amber-400">{member.lag}ms lag</span>}
        {member.lag === 0 && member.state !== 'PRIMARY' && <span className="text-emerald-400">in sync</span>}
      </div>
    </div>
  );
}

// ── Live feed row ─────────────────────────────────────────────────────────────

const FEED_TYPE_META = {
  join:    { label: 'JOIN',    color: 'text-cyan-400',   bg: 'bg-cyan-500/10'   },
  create:  { label: 'CREATE',  color: 'text-purple-400', bg: 'bg-purple-500/10' },
  checkin: { label: 'CHECKIN', color: 'text-emerald-400',bg: 'bg-emerald-500/10'},
  message: { label: 'MSG',     color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  poll:    { label: 'POLL',    color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
};

function FeedRow({ item }) {
  const meta = FEED_TYPE_META[item.type] || FEED_TYPE_META.join;
  const t = new Date(item.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0 animate-[fadeIn_0.3s_ease]">
      <span className="text-[10px] font-mono text-neutral-600 w-20 flex-shrink-0 tabular-nums">{t}</span>
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0 ${meta.bg} ${meta.color}`}>{meta.label}</span>
      <span className="text-xs text-neutral-300 truncate flex-1">{item.event}</span>
      <span className="text-[10px] text-neutral-600 flex-shrink-0 hidden md:block truncate max-w-[140px]">{item.region}</span>
      <span className="text-[10px] font-mono text-green-400 flex-shrink-0 w-10 text-right">{item.ms}ms</span>
    </div>
  );
}

// ── Redis cluster row ─────────────────────────────────────────────────────────

function RedisRow({ cluster }) {
  const roleColor = { cache: 'cyan', session: 'purple', limits: 'amber', pubsub: 'green', queue: 'indigo' };
  const c = roleColor[cluster.role] || 'cyan';
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2">
        <PulseDot color={c === 'amber' ? 'amber' : c === 'green' ? 'emerald' : c} size={1.5} />
        <span className="text-xs font-mono text-neutral-300">{cluster.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${c}-500/10 text-${c}-400`}>{cluster.role}</span>
        <span className="text-xs text-neutral-500 font-mono">{cluster.nodes} nodes</span>
        <span className="text-xs text-neutral-600 font-mono hidden sm:block">{cluster.region}</span>
      </div>
    </div>
  );
}

// ── Main demo dashboard ───────────────────────────────────────────────────────

export default function DemoDashboard({ onLogout }) {
  const [tick, setTick]         = useState(0);
  const [tab, setTab]           = useState('overview');
  const [feed, setFeed]         = useState(() => getLiveFeed());
  const [sparkReqs, setSparkReqs] = useState(() => Array.from({ length: 24 }, () => Math.round(200 + Math.random() * 100)));
  const [sparkLat, setSparkLat]   = useState(() => Array.from({ length: 24 }, () => Math.round(2 + Math.random() * 4)));

  // Live tick every 1.8 s — refreshes all computed values
  useEffect(() => {
    const t = setInterval(() => {
      setTick(n => n + 1);
      setFeed(getLiveFeed());
      setSparkReqs(p => [...p.slice(1), Math.round(260 + Math.random() * 80)]);
      setSparkLat(p =>  [...p.slice(1), Math.round(2 + Math.random() * 5)]);
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const stats   = getDemoStats();
  const fleet   = getDemoFleet();
  const system  = getDemoSystem();
  const scaling = getDemoScaling();

  const TABS = [
    { id: 'overview',  label: 'Overview'      },
    { id: 'fleet',     label: 'Fleet'         },
    { id: 'databases', label: 'Databases'     },
    { id: 'realtime',  label: 'Live Traffic'  },
  ];

  return (
    <div className="min-h-screen bg-[#040810] text-white font-sans" style={{ fontFamily: "'IBM Plex Mono', 'Fira Code', monospace" }}>
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-black/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">PlanIt</span>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded uppercase tracking-widest">Hyperscale</span>
            </div>
            <div className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-1">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${tab === t.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <PulseDot color="emerald" size={1.5} />
              <span className="text-xs text-emerald-400 font-bold">{fleet.totalServers.toLocaleString()} servers online</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono">
              <Clock className="w-3 h-3" />
              <span>{new Date().toUTCString().split(' ').slice(0, 5).join(' ')}</span>
            </div>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-400 transition-colors border border-white/[0.06] px-3 py-1.5 rounded-lg hover:border-red-500/30">
              <LogOut className="w-3 h-3" /> Exit Demo
            </button>
          </div>
        </div>
        {/* Mobile tabs */}
        <div className="md:hidden flex border-t border-white/[0.06] overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 text-xs px-4 py-2.5 font-medium border-b-2 transition-all ${tab === t.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-neutral-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            {/* Hero metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Total Events',    value: fmt(stats.totalEvents),       icon: Calendar,      accent: 'cyan',   sub: `${fmt(stats.recentEvents)} today` },
                { label: 'Participants',    value: fmt(stats.totalParticipants), icon: Users,         accent: 'purple', sub: 'across all events' },
                { label: 'Messages',        value: fmt(stats.totalMessages),     icon: MessageSquare, accent: 'indigo', sub: 'total processed' },
                { label: 'Active Events',   value: fmt(stats.activeEvents),      icon: Activity,      accent: 'green',  badge: 'LIVE' },
                { label: 'Files Stored',    value: fmtBytes(stats.totalStorage), icon: HardDrive,     accent: 'amber',  sub: 'across all DCs' },
                { label: 'Uptime',          value: fleet.uptimePct + '%',        icon: Shield,        accent: 'green',  badge: '6-nines' },
              ].map(m => (
                <MetricCard key={m.label} {...m} />
              ))}
            </div>

            {/* World map + live feed */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">Global Infrastructure</h3>
                    <p className="text-[11px] text-neutral-600 mt-0.5">{DATA_CENTERS.length} data centers · {fleet.totalServers.toLocaleString()} servers · {fleet.dataCenters} regions</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    {[['primary','#22d3ee'],['secondary','#818cf8'],['edge','#34d399']].map(([l,c]) => (
                      <span key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} /><span className="text-neutral-500 capitalize">{l}</span></span>
                    ))}
                  </div>
                </div>
                <WorldMap dataCenters={DATA_CENTERS} />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { label: 'Req/s', value: fmt(fleet.reqPerSecond) },
                    { label: 'p50 Lat', value: fleet.p50LatencyMs + 'ms' },
                    { label: 'p99 Lat', value: fleet.p99LatencyMs + 'ms' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-white/[0.02] rounded-lg py-2">
                      <div className="text-sm font-bold text-cyan-300 font-mono">{s.value}</div>
                      <div className="text-[10px] text-neutral-600 uppercase tracking-wider">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">Live Traffic</h3>
                  <PulseDot color="cyan" size={1.5} />
                </div>
                <div className="mb-3">
                  <SparkBars values={sparkReqs} color="#22d3ee" height={36} />
                  <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                    <span>-42s</span><span>requests/s</span><span>now</span>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {feed.map(item => <FeedRow key={item.id} item={item} />)}
                </div>
              </div>
            </div>

            {/* DC grid */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest mb-3">Data Center Status</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {DATA_CENTERS.map(dc => (
                  <div key={dc.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-all">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-neutral-400 font-mono">{dc.id}</span>
                      <PulseDot color="emerald" size={1} />
                    </div>
                    <div className="text-xs text-neutral-300 mb-1 leading-tight truncate">{dc.name}</div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-neutral-600">{dc.servers.toLocaleString()} srv</span>
                      <span className={`font-mono font-bold ${dc.load > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>{dc.load}% load</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
                      <div className={`h-full rounded-full transition-all ${dc.load > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${dc.load}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── FLEET ── */}
        {tab === 'fleet' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Servers',    value: fleet.totalServers.toLocaleString(),  icon: Server,    accent: 'cyan'   },
                { label: 'Active Servers',   value: fleet.activeServers.toLocaleString(), icon: Activity,  accent: 'green', badge: 'ALL UP' },
                { label: 'Requests / sec',   value: fmt(fleet.reqPerSecond),              icon: Zap,       accent: 'amber'  },
                { label: 'Active WebSockets',value: fmt(system.activeWebsockets),         icon: Wifi,      accent: 'purple' },
              ].map(m => <MetricCard key={m.label} {...m} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Scaling intelligence */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest mb-4">Auto-Scaling Intelligence</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Active / Total backends', value: `${scaling.activeBackendCount.toLocaleString()} / ${scaling.totalBackends.toLocaleString()}`, color: 'cyan' },
                    { label: 'HW Forecast (next window)', value: scaling.predictive.forecast.toLocaleString() + ' req', color: 'purple' },
                    { label: 'HW Trend',  value: `+${scaling.predictive.trend} / window`, color: 'green' },
                    { label: 'PID Integral', value: scaling.pid.integral.toString(), color: 'amber' },
                    { label: 'Anomaly σ Threshold', value: scaling.anomaly.zThreshold + 'σ', color: 'indigo' },
                    { label: 'Circadian Floor', value: scaling.circadian.floor + ' backends minimum', color: 'cyan' },
                    { label: 'Last Scale Action', value: scaling.lastAction.toUpperCase(), color: 'green' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                      <span className="text-xs text-neutral-500">{row.label}</span>
                      <span className={`text-xs font-bold font-mono text-${row.color}-400`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CDN / Edge */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest mb-4">Edge Network</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'CDN Nodes',    value: system.cdnNodes.toLocaleString(),   sub: 'globally distributed'  },
                    { label: 'Edge Caches',  value: system.edgeCaches.toLocaleString(), sub: 'in-flight'             },
                    { label: 'TLS Certs',    value: system.tlsCerts.toLocaleString(),   sub: 'auto-renewing'         },
                    { label: 'Cache Hit %',  value: fleet.cacheHitRate + '%',           sub: 'L1 + L2 combined'      },
                    { label: 'Bandwidth',    value: fleet.bandwidthGbps + ' Gbps',      sub: 'aggregate egress'      },
                    { label: 'TLS/s',        value: fmt(fleet.tlsHandshakesPerSec),     sub: 'new handshakes'        },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-white/[0.03] p-3 border border-white/[0.04]">
                      <div className="text-sm font-bold text-cyan-300 font-mono">{m.value}</div>
                      <div className="text-[10px] text-neutral-600 mt-0.5">{m.label}</div>
                      <div className="text-[9px] text-neutral-700">{m.sub}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">Latency distribution (p50 / p99)</div>
                  <SparkBars values={sparkLat} color="#818cf8" height={28} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── DATABASES ── */}
        {tab === 'databases' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Documents', value: fmt(system.db.totalDocuments), icon: Database, accent: 'cyan' },
                { label: 'Storage',         value: system.db.storageGB + ' GB',   icon: HardDrive, accent: 'purple' },
                { label: 'Active DB Conns', value: system.db.activeConnections.toLocaleString(), icon: Layers, accent: 'green' },
                { label: 'Shards',          value: system.db.shards.toString(),   icon: GitBranch, accent: 'amber' },
              ].map(m => <MetricCard key={m.label} {...m} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* MongoDB replica set */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">MongoDB Replica Set</h3>
                  <span className="ml-auto text-[10px] text-neutral-600 font-mono">{system.db.name}</span>
                </div>
                {system.db.replicaSet.members.map(m => <ReplicaRow key={m.name} member={m} />)}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    { label: 'Insert ops', value: fmt(system.db.opCounters.insert) },
                    { label: 'Query ops',  value: fmt(system.db.opCounters.query)  },
                    { label: 'Update ops', value: fmt(system.db.opCounters.update) },
                    { label: 'Delete ops', value: fmt(system.db.opCounters.delete) },
                  ].map(op => (
                    <div key={op.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-emerald-400 font-mono">{op.value}</div>
                      <div className="text-[9px] text-neutral-600">{op.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Redis clusters */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">Redis Cluster</h3>
                  <span className="ml-auto text-[10px] text-neutral-600 font-mono">v{system.redis.version} · {system.redis.mode}</span>
                </div>
                {system.redis.clusters.map(c => <RedisRow key={c.name} cluster={c} />)}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total Keys',  value: fmt(system.redis.totalKeys) },
                    { label: 'Memory',      value: fmt(system.redis.usedMemoryMB) + 'MB' },
                    { label: 'Ops/sec',     value: fmt(system.redis.opsPerSec) },
                  ].map(op => (
                    <div key={op.label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                      <div className="text-xs font-bold text-red-400 font-mono">{op.value}</div>
                      <div className="text-[9px] text-neutral-600">{op.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${system.redis.hitRate}%` }} />
                  </div>
                  <span className="text-xs font-mono text-red-400">{system.redis.hitRate}% hit rate</span>
                </div>
              </div>
            </div>

            {/* Message queues */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest mb-4">Message Queues</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(system.queues).map(([name, q]) => (
                  <div key={name} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <PulseDot color="cyan" size={1.5} />
                      <span className="text-xs font-bold text-neutral-300 uppercase">{name}</span>
                    </div>
                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between"><span className="text-neutral-600">pending</span><span className="text-cyan-400">{q.pending.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-600">processing</span><span className="text-green-400">{q.processing.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-neutral-600">throughput</span><span className="text-purple-400">{q.throughputPerMin.toLocaleString()}/m</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── LIVE TRAFFIC ── */}
        {tab === 'realtime' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Req / sec',       value: fmt(fleet.reqPerSecond),          icon: Zap,    accent: 'cyan'   },
                { label: 'Socket Rooms',    value: fmt(system.socketRooms),          icon: Radio,  accent: 'purple' },
                { label: 'WS Connections',  value: fmt(system.activeWebsockets),     icon: Wifi,   accent: 'green'  },
                { label: 'CPU (128 cores)', value: system.cpu.load1 + ' load avg',   icon: Cpu,    accent: 'amber'  },
              ].map(m => <MetricCard key={m.label} {...m} />)}
            </div>

            {/* Big live feed */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-widest">Global Event Stream</h3>
                  <p className="text-[10px] text-neutral-600 mt-0.5">Real-time activity across all regions · updates every 1.8s</p>
                </div>
                <div className="flex items-center gap-2">
                  <PulseDot color="cyan" />
                  <span className="text-xs text-cyan-400 font-bold font-mono">{fmt(fleet.reqPerSecond)} req/s</span>
                </div>
              </div>
              <div className="mb-4">
                <SparkBars values={sparkReqs} color="#22d3ee" height={48} />
                <div className="flex justify-between text-[10px] text-neutral-700 mt-1">
                  <span>42 sec ago</span>
                  {Array.from({ length: 5 }, (_, i) => <span key={i}>{(42 - i * 8)}s</span>)}
                  <span>now</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div>
                  <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04] mb-1">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest w-20">time</span>
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest w-16">type</span>
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest flex-1">event</span>
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest w-10 text-right">lat</span>
                  </div>
                  {feed.map(item => <FeedRow key={item.id} item={item} />)}
                </div>
                <div className="md:pl-6 mt-4 md:mt-0">
                  <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3">Process Health</div>
                  <div className="space-y-2">
                    {[
                      { label: 'Heap used',    value: system.memory.heapUsed + 'MB', pct: system.memory.pct, color: 'cyan' },
                      { label: 'RSS',          value: system.memory.rss + 'MB',      pct: Math.round(system.memory.rss / system.os.totalMem * 100), color: 'purple' },
                      { label: 'System mem',   value: ((system.os.totalMem - system.os.freeMem) / 1024).toFixed(1) + 'GB / ' + (system.os.totalMem / 1024).toFixed(0) + 'GB', pct: Math.round((system.os.totalMem - system.os.freeMem) / system.os.totalMem * 100), color: 'green' },
                    ].map(m => (
                      <div key={m.label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-neutral-500">{m.label}</span>
                          <span className={`font-mono text-${m.color}-400`}>{m.value}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className={`h-full bg-${m.color}-400 rounded-full transition-all`} style={{ width: `${Math.min(m.pct, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Node uptime</div>
                  <div className="text-2xl font-bold text-white font-mono">{fmtUptime(system.process.uptime)}</div>
                  <div className="text-[10px] text-neutral-600 mt-1">{system.process.nodeVersion} · {system.process.platform} · {system.os.cpus} vCPUs</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-white/[0.04] pt-4 flex items-center justify-between text-[10px] text-neutral-700 font-mono">
          <span>PlanIt Infrastructure Console · Demo Mode</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            OPERATIONAL · {fleet.uptimePct}% SLA
          </span>
        </div>
      </div>
    </div>
  );
}
