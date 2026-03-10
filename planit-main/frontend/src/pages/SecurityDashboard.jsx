import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { routerAPI } from '../services/api';

const VIEWS = [
  { id: 'overview',  label: 'Overview'       },
  { id: 'feed',      label: 'Live Feed'      },
  { id: 'threats',   label: 'Threats'        },
  { id: 'infra',     label: 'Infrastructure' },
  { id: 'logs',      label: 'Logs'           },
];
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ts(iso) {
  if (!iso) return '--:--:--';
  return new Date(iso).toLocaleTimeString('en-US', { hour12: false });
}
function ago(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}
function fmtMB(mb) { return mb != null ? mb + ' MB' : '—'; }
function levelColor(lvl) {
  if (!lvl) return '#6b7280';
  const l = lvl.toLowerCase();
  if (l === 'error') return '#f87171';
  if (l === 'warn')  return '#fbbf24';
  if (l === 'info')  return '#60a5fa';
  if (l === 'debug') return '#a78bfa';
  return '#6b7280';
}
function levelBg(lvl) {
  if (!lvl) return 'transparent';
  const l = lvl.toLowerCase();
  if (l === 'error') return 'rgba(248,113,113,0.07)';
  if (l === 'warn')  return 'rgba(251,191,36,0.07)';
  if (l === 'info')  return 'rgba(96,165,250,0.05)';
  return 'transparent';
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
function useAdminAuth() {
  const [auth, setAuth] = useState(null);
  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (t) { api.defaults.headers.common['Authorization'] = 'Bearer ' + t; setAuth(true); }
    else setAuth(false);
  }, []);
  return auth;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useSecurityIntel() {
  const [data, setData] = useState(null);
  const load = useCallback(() => { api.get('/admin/cc/security-intel').then(r => setData(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  return { data, refresh: load };
}
function useWsStats() {
  const [data, setData] = useState(null);
  const load = useCallback(() => { api.get('/admin/cc/ws-stats').then(r => setData(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  return data;
}
function useRouterStatus() {
  const [data, setData] = useState(null);
  const load = useCallback(() => { routerAPI.getStatus()?.then(r => r && setData(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  return data;
}
function useAdminStats() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/admin/stats').then(r => setData(r.data)).catch(() => {}); }, []);
  return data;
}
function useBlocklist() {
  const [data, setData] = useState([]);
  useEffect(() => { api.get('/admin/blocklist').then(r => setData(r.data.entries || [])).catch(() => {}); }, []);
  return data;
}
function useLiveStream(max = 800) {
  const [logs, setLogs] = useState([]);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const url = API_URL + '/admin/logs/stream' + (token ? '?token=' + encodeURIComponent(token) : '');
    const es = new EventSource(url);
    es.onopen = () => setOk(true);
    es.onerror = () => setOk(false);
    es.onmessage = e => {
      try {
        const entry = JSON.parse(e.data);
        setLogs(p => { const n = [...p, { ...entry, _k: Math.random() }]; return n.length > max ? n.slice(-max) : n; });
      } catch {}
    };
    return () => { es.close(); setOk(false); };
  }, [max]);
  return { logs, ok };
}
function useLogHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/admin/logs', { params: { n: 1000 } })
      .then(r => setLogs((r.data.logs || []).slice().reverse()))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { logs, loading };
}

// ─── Primitives ───────────────────────────────────────────────────────────────
const Dot = ({ color = '#22c55e', pulse }) => (
  <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:color, flexShrink:0,
    animation: pulse ? 'pd 2s ease-in-out infinite' : 'none' }} />
);
const Stat = ({ label, value, sub, accent }) => (
  <div style={{ background:'#111827', borderRadius:8, padding:'10px 14px', flex:1, minWidth:90 }}>
    <div style={{ fontSize:22, fontWeight:800, color: accent || '#e2e8f0', fontVariantNumeric:'tabular-nums' }}>{value ?? '—'}</div>
    <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'#4b5563', marginTop:2 }}>{label}</div>
    {sub && <div style={{ fontSize:10, color:'#6b7280', marginTop:3 }}>{sub}</div>}
  </div>
);
const Panel = ({ title, children, right, col, row }) => (
  <div style={{ background:'#0d0d14', border:'1px solid #1a1a2a', borderRadius:10, overflow:'hidden', display:'flex', flexDirection:'column', gridColumn: col, gridRow: row }}>
    {title && (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px 8px', borderBottom:'1px solid #111827', flexShrink:0 }}>
        <span style={{ fontSize:10, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#6b7280' }}>{title}</span>
        {right}
      </div>
    )}
    <div style={{ padding:'12px 14px', flex:1, overflow:'hidden' }}>{children}</div>
  </div>
);
const KV = ({ k, v, mono, accent }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0', borderBottom:'1px solid #111827', fontSize:12 }}>
    <span style={{ color:'#6b7280' }}>{k}</span>
    <span style={{ color: accent || '#d1d5db', fontWeight:500, fontFamily: mono ? 'monospace' : undefined }}>{v ?? '—'}</span>
  </div>
);

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewView() {
  const { data: sec }    = useSecurityIntel();
  const ws               = useWsStats();
  const router           = useRouterStatus();
  const stats            = useAdminStats();
  const { logs, ok }     = useLiveStream(80);
  const backends         = router?.backends || [];
  const alive            = backends.filter(b => b.alive).length;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      {/* Stats bar */}
      <Panel title="Platform Health" col="1 / 5" right={
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Dot color={sec?.errSpike ? '#f87171' : '#22c55e'} pulse={!!sec?.errSpike} />
          <span style={{ fontSize:11, color: sec?.errSpike ? '#f87171' : '#22c55e' }}>{sec?.errSpike ? 'Anomaly Detected' : 'Nominal'}</span>
        </div>
      }>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Stat label="WS Connections" value={ws?.wsStats?.connected ?? '—'} />
          <Stat label="Backends Alive" value={`${alive}/${backends.length || '—'}`} accent={backends.length && alive < backends.length ? '#f87171' : undefined} />
          <Stat label="Errors 1h" value={sec?.errLast1h ?? '—'} accent={(sec?.errLast1h || 0) > 10 ? '#f87171' : undefined} />
          <Stat label="Errors 24h" value={sec?.errLast24h ?? '—'} />
          <Stat label="Events" value={stats?.totalEvents ?? '—'} />
          <Stat label="Config Score" value={ws?.configScore != null ? ws.configScore + '%' : '—'} accent={ws?.configScore < 80 ? '#fbbf24' : '#22c55e'} />
          <Stat label="Redis" value={ws?.redisHealth?.mode ?? '—'} sub={ws?.redisHealth?.pingMs != null ? ws.redisHealth.pingMs + 'ms' : undefined} />
          <Stat label="Failed Logins" value={sec?.failedLogins?.length ?? '—'} accent={(sec?.failedLogins?.length || 0) > 5 ? '#f87171' : undefined} />
        </div>
      </Panel>

      {/* Backends */}
      <Panel title="Backends" col="1 / 3">
        {backends.length === 0
          ? <div style={{ color:'#374151', fontSize:12, padding:'8px 0' }}>No data</div>
          : backends.map((b, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid #111827', fontSize:12 }}>
              <Dot color={b.alive ? (b.circuitTripped ? '#fbbf24' : '#22c55e') : '#f87171'} pulse={!b.alive} />
              <span style={{ color:'#e2e8f0', fontWeight:600, flex:1 }}>{b.name}</span>
              <span style={{ fontFamily:'monospace', color:'#60a5fa', fontSize:11 }}>{b.latencyMs != null ? b.latencyMs + 'ms' : '—'}</span>
              <span style={{ fontFamily:'monospace', color:'#4b5563', fontSize:11 }}>{b.requests ?? 0} req</span>
              {b.circuitTripped && <span style={{ fontSize:9, color:'#fbbf24', background:'rgba(251,191,36,0.1)', padding:'1px 5px', borderRadius:3 }}>TRIP</span>}
            </div>
          ))}
      </Panel>

      {/* Auth failures */}
      <Panel title="Auth Failures" col="3 / 5">
        {(sec?.failedLogins || []).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ None recorded</div>
          : [...(sec.failedLogins)].reverse().slice(0, 7).map((f, i) => (
            <div key={i} style={{ display:'flex', gap:8, padding:'3px 0 3px 8px', borderLeft:'2px solid #f87171', marginBottom:3, fontSize:11 }}>
              <span style={{ fontFamily:'monospace', color:'#4b5563', flexShrink:0 }}>{ts(f.ts)}</span>
              <span style={{ color:'#fca5a5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.msg}</span>
            </div>
          ))}
      </Panel>

      {/* Top errors */}
      <Panel title="Top Error Patterns" col="1 / 3">
        {(sec?.topErrors || []).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ No errors</div>
          : sec.topErrors.slice(0, 6).map((e, i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'4px 0', borderBottom:'1px solid #111827', fontSize:11, alignItems:'flex-start' }}>
              <span style={{ color:'#f87171', fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>{String(e.count).padStart(3,'0')}×</span>
              <span style={{ color:'#9ca3af' }}>{e.msg}</span>
            </div>
          ))}
      </Panel>

      {/* Rate limits */}
      <Panel title="Rate Limit Hits" col="3 / 5">
        {(sec?.rateLimitHits || []).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ None</div>
          : [...(sec.rateLimitHits)].reverse().slice(0, 7).map((f, i) => (
            <div key={i} style={{ display:'flex', gap:8, padding:'3px 0 3px 8px', borderLeft:'2px solid #fbbf24', marginBottom:3, fontSize:11 }}>
              <span style={{ fontFamily:'monospace', color:'#4b5563', flexShrink:0 }}>{ts(f.ts)}</span>
              <span style={{ color:'#fde68a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.msg}</span>
            </div>
          ))}
      </Panel>

      {/* Live tail */}
      <Panel title="Live Log Tail" col="1 / 5" right={
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Dot color={ok ? '#22c55e' : '#f87171'} pulse={ok} />
          <span style={{ fontSize:10, fontFamily:'monospace', color: ok ? '#22c55e' : '#f87171' }}>{ok ? 'SSE LIVE' : 'OFFLINE'}</span>
        </div>
      }>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          {[...logs].reverse().slice(0, 8).map((l, i) => (
            <div key={l._k || i} style={{ display:'flex', gap:8, padding:'2px 6px', borderLeft:'2px solid ' + levelColor(l.level), background: levelBg(l.level), borderRadius:3, fontSize:11, fontFamily:'monospace', alignItems:'baseline' }}>
              <span style={{ color:'#374151', flexShrink:0 }}>{ts(l.ts)}</span>
              <span style={{ color: levelColor(l.level), fontWeight:700, width:36, flexShrink:0 }}>{(l.level||'LOG').toUpperCase()}</span>
              <span style={{ color:'#4b5563', width:60, flexShrink:0 }}>{(l.source||'backend').slice(0,8)}</span>
              <span style={{ color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.msg}</span>
            </div>
          ))}
          {logs.length === 0 && <div style={{ color:'#374151', fontSize:12 }}>Waiting for events…</div>}
        </div>
      </Panel>
    </div>
  );
}

// ─── Live Feed ─────────────────────────────────────────────────────────────────
function LiveFeedView() {
  const { logs, ok } = useLiveStream(1000);
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const [autoscroll, setAutoscroll] = useState(true);
  const [filter, setFilter] = useState('');
  const [lvl, setLvl] = useState('all');

  useEffect(() => {
    if (autoscroll && !paused && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, autoscroll, paused]);

  const visible = logs
    .filter(l => lvl === 'all' || (l.level||'info').toLowerCase() === lvl)
    .filter(l => !filter || (l.msg||'').toLowerCase().includes(filter.toLowerCase()))
    .slice(-700);

  const counts = {};
  logs.forEach(l => { const k = (l.level||'info').toLowerCase(); counts[k] = (counts[k]||0) + 1; });

  const TB = {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'7px 12px', background:'#0d0d14', border:'1px solid #1a1a2a',
    borderRadius:'8px 8px 0 0', flexShrink:0
  };
  const Btn = ({ children, active, color, onClick }) => (
    <button onClick={onClick} style={{
      fontSize:10, fontWeight:700, letterSpacing:'0.07em', fontFamily:'monospace',
      padding:'3px 8px', borderRadius:5, border:'none', cursor:'pointer',
      background: active ? (color||'#334155') : '#111827',
      color: active ? '#e2e8f0' : (color||'#6b7280'),
      transition:'all 0.15s'
    }}>{children}</button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 130px)' }}>
      <div style={TB}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Dot color={ok ? '#22c55e' : '#f87171'} pulse={ok} />
          <span style={{ fontFamily:'monospace', fontSize:11, color: ok ? '#22c55e' : '#f87171' }}>{ok ? 'LIVE' : 'OFFLINE'}</span>
          <span style={{ fontFamily:'monospace', fontSize:10, color:'#374151' }}>{logs.length} entries</span>
        </div>
        <div style={{ display:'flex', gap:5, alignItems:'center', flexWrap:'wrap' }}>
          {['error','warn','info','debug'].map(l => counts[l] > 0 && (
            <Btn key={l} active={lvl===l} color={levelColor(l)} onClick={() => setLvl(f => f===l?'all':l)}>
              {l.toUpperCase()} {counts[l]}
            </Btn>
          ))}
          <input
            style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:5, padding:'3px 8px', fontSize:11, color:'#9ca3af', outline:'none', fontFamily:'monospace', width:140 }}
            placeholder="filter…" value={filter} onChange={e => setFilter(e.target.value)}
          />
          <Btn active={paused} onClick={() => setPaused(v => !v)}>{paused ? '▶ RESUME' : '⏸ PAUSE'}</Btn>
          <Btn active={autoscroll} onClick={() => setAutoscroll(v => !v)}>AUTO↓</Btn>
        </div>
      </div>
      <div ref={ref} style={{ flex:1, overflowY:'auto', background:'#050508', border:'1px solid #1a1a2a', borderTop:'none', borderRadius:'0 0 8px 8px', padding:'2px 0' }}>
        {visible.map((l, i) => (
          <div key={l._k || i} style={{
            display:'flex', gap:10, padding:'2px 10px 2px 8px',
            fontSize:11, fontFamily:'monospace', alignItems:'baseline',
            borderLeft:'2px solid ' + levelColor(l.level),
          }}>
            <span style={{ color:'#374151', flexShrink:0, width:75 }}>{ts(l.ts)}</span>
            <span style={{ color: levelColor(l.level), fontWeight:700, flexShrink:0, width:42 }}>{(l.level||'LOG').toUpperCase()}</span>
            <span style={{ color:'#4b5563', flexShrink:0, width:86 }}>[{(l.source||'backend').slice(0,7)}]</span>
            <span style={{ color: l.level==='error' ? '#fca5a5' : l.level==='warn' ? '#fde68a' : '#d1d5db', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.msg}</span>
          </div>
        ))}
        {visible.length === 0 && <div style={{ padding:'2rem', color:'#374151', fontFamily:'monospace', fontSize:13 }}>Waiting…</div>}
      </div>
    </div>
  );
}

// ─── Threats ──────────────────────────────────────────────────────────────────
function ThreatsView() {
  const { data: sec, refresh } = useSecurityIntel();
  const blocklist = useBlocklist();

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      <Panel title="Threat Summary" col="1 / 5" right={
        <button onClick={refresh} style={{ background:'transparent', border:'none', color:'#6b7280', cursor:'pointer', fontSize:14 }}>↻</button>
      }>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <Stat label="Failed Logins"    value={sec?.failedLogins?.length ?? '—'}         accent={(sec?.failedLogins?.length||0)>5?'#f87171':undefined} />
          <Stat label="Rate Limit Hits"  value={sec?.rateLimitHits?.length ?? '—'}         accent={(sec?.rateLimitHits?.length||0)>10?'#fbbf24':undefined} />
          <Stat label="Errors (1h)"      value={sec?.errLast1h ?? '—'}                     accent={sec?.errSpike?'#f87171':undefined} sub={sec?.errSpike ? '⚠ Spike' : undefined} />
          <Stat label="Errors (24h)"     value={sec?.errLast24h ?? '—'} />
          <Stat label="Suspicious Users" value={sec?.suspiciousParticipants?.length ?? '—'} accent={(sec?.suspiciousParticipants?.length||0)>0?'#fbbf24':undefined} />
          <Stat label="Blocklist"        value={blocklist.length} />
        </div>
      </Panel>

      {/* Failed logins */}
      <Panel title="Failed Login Attempts" col="1 / 3">
        {(sec?.failedLogins||[]).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ None</div>
          : <div style={{ maxHeight:240, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
              {[...(sec.failedLogins)].reverse().map((f, i) => (
                <div key={i} style={{ display:'flex', gap:8, padding:'4px 8px', background:'rgba(248,113,113,0.05)', borderLeft:'2px solid rgba(248,113,113,0.3)', borderRadius:3, fontSize:11 }}>
                  <span style={{ fontFamily:'monospace', color:'#4b5563', flexShrink:0 }}>{ts(f.ts)}</span>
                  <span style={{ color:'#fca5a5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.msg}</span>
                </div>
              ))}
            </div>}
      </Panel>

      {/* Rate limits */}
      <Panel title="Rate Limit Events" col="3 / 5">
        {(sec?.rateLimitHits||[]).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ None</div>
          : <div style={{ maxHeight:240, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
              {[...(sec.rateLimitHits)].reverse().map((f, i) => (
                <div key={i} style={{ display:'flex', gap:8, padding:'4px 8px', background:'rgba(251,191,36,0.05)', borderLeft:'2px solid rgba(251,191,36,0.3)', borderRadius:3, fontSize:11 }}>
                  <span style={{ fontFamily:'monospace', color:'#4b5563', flexShrink:0 }}>{ts(f.ts)}</span>
                  <span style={{ color:'#fde68a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.msg}</span>
                </div>
              ))}
            </div>}
      </Panel>

      {/* Top errors */}
      <Panel title="Top Error Patterns" col="1 / 3">
        {(sec?.topErrors||[]).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ No errors</div>
          : (sec.topErrors).map((e, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'5px 0', borderBottom:'1px solid #111827', fontSize:11, alignItems:'flex-start' }}>
              <span style={{ color:'#f87171', fontFamily:'monospace', fontWeight:700, flexShrink:0 }}>{String(e.count).padStart(3,'0')}×</span>
              <span style={{ color:'#9ca3af' }}>{e.msg}</span>
            </div>
          ))}
      </Panel>

      {/* Suspicious */}
      <Panel title="Suspicious Accounts" col="3 / 5">
        {(sec?.suspiciousParticipants||[]).length === 0
          ? <div style={{ color:'#22c55e', fontSize:12 }}>✓ None detected</div>
          : (sec.suspiciousParticipants).map((u, i) => (
            <div key={i} style={{ display:'flex', padding:'4px 8px', background:'rgba(251,191,36,0.05)', borderLeft:'2px solid rgba(251,191,36,0.3)', borderRadius:3, marginBottom:3, fontSize:11, justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily:'monospace', color:'#fde68a', fontWeight:700 }}>{u._id}</span>
              <span style={{ color:'#fbbf24' }}>{u.count} joins</span>
            </div>
          ))}
      </Panel>

      {/* Blocklist */}
      <Panel title="Active Blocklist" col="1 / 5">
        {blocklist.length === 0
          ? <div style={{ color:'#374151', fontSize:12, padding:'8px 0' }}>No entries</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{['Type','Value','Reason','Added'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'#4b5563', borderBottom:'1px solid #1f2937' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {blocklist.slice(0, 40).map((b, i) => (
                    <tr key={i}>
                      <td style={{ padding:'6px 10px', borderBottom:'1px solid #111827' }}>
                        <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'#a78bfa', background:'rgba(167,139,250,0.1)', padding:'2px 6px', borderRadius:4 }}>{b.type||'—'}</span>
                      </td>
                      <td style={{ padding:'6px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', fontSize:11, color:'#e2e8f0' }}>{b.value}</td>
                      <td style={{ padding:'6px 10px', borderBottom:'1px solid #111827', color:'#6b7280' }}>{b.reason||'—'}</td>
                      <td style={{ padding:'6px 10px', borderBottom:'1px solid #111827', color:'#4b5563', fontSize:11 }}>{ago(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </Panel>
    </div>
  );
}

// ─── Infra ─────────────────────────────────────────────────────────────────────
function InfraView() {
  const ws      = useWsStats();
  const router  = useRouterStatus();
  const backends = router?.backends || [];
  const scaling  = router?.scaling;
  const proc     = ws?.process;

  const heapPct = proc?.memMB?.heapUsed && proc?.memMB?.heapTotal
    ? Math.round((proc.memMB.heapUsed / proc.memMB.heapTotal) * 100) : null;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      <Panel title="Process" col="1 / 2">
        <KV k="Node.js" v={proc?.node} mono />
        <KV k="PID" v={proc?.pid} mono />
        <KV k="Uptime" v={proc?.uptime != null ? Math.floor(proc.uptime/3600) + 'h ' + Math.floor((proc.uptime%3600)/60) + 'm' : null} />
        <KV k="CPU Cores" v={proc?.cpuCount} />
        <KV k="Load Avg" v={proc?.loadAvg?.join(' / ')} mono />
        <KV k="Free Mem" v={fmtMB(proc?.freeMemMB)} />
        <KV k="Total Mem" v={fmtMB(proc?.totalMemMB)} />
      </Panel>

      <Panel title="Heap Memory" col="2 / 3">
        <KV k="Heap Used" v={fmtMB(proc?.memMB?.heapUsed)} accent="#60a5fa" />
        <KV k="Heap Total" v={fmtMB(proc?.memMB?.heapTotal)} />
        <KV k="RSS" v={fmtMB(proc?.memMB?.rss)} />
        {heapPct != null && <>
          <KV k="Usage" v={heapPct + '%'} />
          <div style={{ margin:'8px 0 0', height:4, background:'#1f2937', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width: heapPct + '%', background:'#60a5fa', borderRadius:2, transition:'width 0.5s ease' }} />
          </div>
        </>}
      </Panel>

      <Panel title="WebSocket" col="3 / 4">
        <KV k="Connections" v={ws?.wsStats?.connected} accent="#22c55e" />
        <KV k="Rooms" v={ws?.wsStats?.rooms} />
        <KV k="Mode" v={ws?.wsStats?.note} mono />
      </Panel>

      <Panel title="Redis" col="4 / 5">
        <KV k="Mode" v={ws?.redisHealth?.mode} />
        <KV k="Connected" v={
          ws?.redisHealth != null
            ? <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <Dot color={ws.redisHealth.connected ? '#22c55e' : '#f87171'} />
                {ws.redisHealth.connected ? 'Yes' : 'No'}
              </div>
            : null
        } />
        {ws?.redisHealth?.pingMs != null && <KV k="Ping" v={ws.redisHealth.pingMs + 'ms'} accent="#60a5fa" />}
        <KV k="Ping OK" v={ws?.redisHealth?.pingOk == null ? null : ws.redisHealth.pingOk ? '✓ Yes' : '✗ No'} accent={ws?.redisHealth?.pingOk ? '#22c55e' : '#f87171'} />
      </Panel>

      <Panel title="Config Checklist" col="1 / 3">
        {(ws?.config || []).map((c, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', borderBottom:'1px solid #111827', fontSize:12 }}>
            <span style={{ color: c.set ? '#22c55e' : '#f87171', fontSize:14 }}>{c.set ? '✓' : '✗'}</span>
            <span style={{ color: c.set ? '#d1d5db' : '#6b7280' }}>{c.label}</span>
          </div>
        ))}
        {ws?.configScore != null && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>Score: {ws.configScore}%</div>
            <div style={{ height:4, background:'#1f2937', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width: ws.configScore + '%', background: ws.configScore > 80 ? '#22c55e' : ws.configScore > 60 ? '#fbbf24' : '#f87171', borderRadius:2 }} />
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Router Scaling" col="3 / 5">
        {!scaling ? <div style={{ color:'#374151', fontSize:12 }}>No router data</div> : <>
          <KV k="Active Backends" v={scaling.activeBackendCount} accent="#22c55e" />
          <KV k="Total Backends" v={scaling.totalBackends} />
          <KV k="Tripped Circuits" v={scaling.trippedCount} accent={scaling.trippedCount > 0 ? '#f87171' : '#22c55e'} />
          <KV k="HW Level" v={scaling.predictive?.level} mono />
          <KV k="HW Trend" v={scaling.predictive?.trend} mono />
          <KV k="Forecast" v={scaling.predictive?.forecast} mono />
          <KV k="Scale↑ Threshold" v={scaling.thresholds?.scaleUp} />
        </>}
      </Panel>

      <Panel title="All Backends" col="1 / 5">
        {backends.length === 0
          ? <div style={{ color:'#374151', fontSize:12, padding:'8px 0' }}>No backend data</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{['Name','Status','Latency','Requests','Window','Connections','Memory','Circuit','Last Ping'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'#4b5563', borderBottom:'1px solid #1f2937', whiteSpace:'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {backends.map((b, i) => (
                    <tr key={i}>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontWeight:600, color:'#e2e8f0' }}>{b.name}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                          <Dot color={b.alive ? '#22c55e' : '#f87171'} pulse={!b.alive} />
                          <span style={{ fontSize:11, color: b.alive ? '#22c55e' : '#f87171' }}>{b.alive ? 'ALIVE' : 'DOWN'}</span>
                        </div>
                      </td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', color: (b.latencyMs||0) > 1000 ? '#fbbf24' : '#60a5fa' }}>{b.latencyMs != null ? b.latencyMs + 'ms' : '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', color:'#9ca3af' }}>{b.requests ?? 0}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', color:'#9ca3af' }}>{b.windowRequests ?? 0}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', color:'#9ca3af' }}>{b.activeConnections ?? 0}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', fontFamily:'monospace', color:'#9ca3af' }}>{b.memoryPct != null ? b.memoryPct + '%' : '—'}</td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827' }}>
                        {b.circuitTripped
                          ? <span style={{ fontSize:9, fontWeight:700, color:'#fbbf24', background:'rgba(251,191,36,0.1)', padding:'2px 6px', borderRadius:4 }}>TRIPPED</span>
                          : <span style={{ fontSize:11, color:'#22c55e' }}>OK</span>}
                      </td>
                      <td style={{ padding:'7px 10px', borderBottom:'1px solid #111827', color:'#4b5563', fontSize:11 }}>{ago(b.lastPing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </Panel>
    </div>
  );
}

// ─── Logs ──────────────────────────────────────────────────────────────────────
function LogsView() {
  const { logs, loading } = useLogHistory();
  const [search, setSearch] = useState('');
  const [lvl, setLvl] = useState('all');

  const counts = {};
  logs.forEach(l => { const k = (l.level||'info').toLowerCase(); counts[k] = (counts[k]||0) + 1; });

  const filtered = logs
    .filter(l => lvl === 'all' || (l.level||'info').toLowerCase() === lvl)
    .filter(l => !search || (l.msg||'').toLowerCase().includes(search.toLowerCase()) || (l.source||'').toLowerCase().includes(search.toLowerCase()))
    .slice(0, 600);

  const Btn = ({ id, children }) => (
    <button onClick={() => setLvl(id)} style={{
      fontSize:10, fontWeight:700, letterSpacing:'0.07em', fontFamily:'monospace',
      padding:'3px 8px', borderRadius:5, border:'none', cursor:'pointer',
      background: lvl === id ? levelColor(id === 'all' ? '#6b7280' : id) : '#111827',
      color: lvl === id ? '#0a0a0f' : levelColor(id === 'all' ? null : id),
    }}>{children}</button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 130px)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 12px', background:'#0d0d14', border:'1px solid #1a1a2a', borderRadius:'8px 8px 0 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontFamily:'monospace', fontSize:11, color:'#6b7280' }}>{loading ? 'Loading…' : logs.length + ' entries'}</span>
          {['error','warn','info'].map(l => counts[l] > 0 && (
            <span key={l} style={{ fontFamily:'monospace', fontSize:11, color: levelColor(l) }}>{l.toUpperCase().slice(0,3)} {counts[l]}</span>
          ))}
        </div>
        <div style={{ display:'flex', gap:5 }}>
          <Btn id="all">ALL</Btn>
          <Btn id="error">ERROR</Btn>
          <Btn id="warn">WARN</Btn>
          <Btn id="info">INFO</Btn>
          <input
            style={{ background:'#111827', border:'1px solid #1f2937', borderRadius:5, padding:'3px 8px', fontSize:11, color:'#9ca3af', outline:'none', fontFamily:'monospace', width:160 }}
            placeholder="search logs…" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', background:'#050508', border:'1px solid #1a1a2a', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
        {filtered.map((l, i) => (
          <div key={i} style={{ display:'flex', gap:10, padding:'2px 10px 2px 8px', fontSize:11, fontFamily:'monospace', alignItems:'baseline', borderLeft:'2px solid ' + levelColor(l.level) }}>
            <span style={{ color:'#374151', flexShrink:0, width:75 }}>{ts(l.ts)}</span>
            <span style={{ color: levelColor(l.level), fontWeight:700, flexShrink:0, width:42 }}>{(l.level||'LOG').toUpperCase()}</span>
            <span style={{ color:'#4b5563', flexShrink:0, width:86 }}>[{(l.source||'backend').slice(0,7)}]</span>
            <span style={{ color: l.level==='error' ? '#fca5a5' : l.level==='warn' ? '#fde68a' : '#d1d5db', flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.msg}</span>
          </div>
        ))}
        {!loading && filtered.length === 0 && <div style={{ padding:'2rem', color:'#374151', fontFamily:'monospace', fontSize:13 }}>No matching entries.</div>}
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function SecurityDashboard() {
  const auth = useAdminAuth();
  const [view, setView] = useState(() => {
    const h = window.location.hash.replace('#', '');
    return VIEWS.find(v => v.id === h)?.id || 'overview';
  });
  const [now, setNow] = useState(new Date());

  useEffect(() => { window.location.hash = view; }, [view]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (auth === null) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:28, height:28, border:'2px solid #1e293b', borderTopColor:'#60a5fa', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  if (!auth) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ color:'#f87171', fontFamily:'monospace', fontSize:14 }}>⚠ NOT AUTHENTICATED</div>
      <a href="/admin" style={{ color:'#60a5fa', fontFamily:'monospace', fontSize:12 }}>← Return to Admin</a>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', color:'#d1d5db', fontFamily:'ui-sans-serif, system-ui, sans-serif', display:'flex', flexDirection:'column' }}>
      <style>{`
        * { box-sizing: border-box; margin:0; padding:0; }
        body { background:#0a0a0f; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pd { 0%,100% { opacity:1; } 50% { opacity:0.2; } }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1f2937; border-radius:2px; }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', height:48, background:'#0d0d14', borderBottom:'1px solid #1a1a2a', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <a href="/admin" style={{ fontSize:11, color:'#4b5563', textDecoration:'none' }}>← Admin</a>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'#e2e8f0' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#60a5fa', boxShadow:'0 0 8px #60a5fa' }} />
            PlanIt Security
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:10, color:'#374151', fontFamily:'monospace', letterSpacing:'0.1em' }}>
            {VIEWS.find(v => v.id === view)?.label?.toUpperCase()} VIEW
          </span>
          <span style={{ fontFamily:'monospace', fontSize:12, color:'#475569' }}>{now.toLocaleTimeString('en-US', { hour12:false })}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, padding:'7px 16px', background:'#0d0d14', borderBottom:'1px solid #111827', flexShrink:0 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding:'5px 14px', fontSize:11, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase',
            border:'none', borderRadius:6, cursor:'pointer', transition:'all 0.15s',
            background: view === v.id ? 'rgba(96,165,250,0.12)' : 'transparent',
            color: view === v.id ? '#e2e8f0' : '#4b5563',
          }}>{v.label}</button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:10, color:'#1e293b', fontFamily:'monospace', alignSelf:'center' }}>
          # bookmark with URL hash to pin a view on a second monitor
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflow:'auto', padding:16 }}>
        {view === 'overview' && <OverviewView />}
        {view === 'feed'     && <LiveFeedView />}
        {view === 'threats'  && <ThreatsView />}
        {view === 'infra'    && <InfraView />}
        {view === 'logs'     && <LogsView />}
      </div>
    </div>
  );
}
