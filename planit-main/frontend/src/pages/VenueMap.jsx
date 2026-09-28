import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon, Plus, Trash2, Link2, Search, MapPin, Compass, PencilRuler, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LANDMARK_TYPES, uid, planH, shareLink, layoutFromHash, decodeLayout,
  loadDraft, saveDraft, loadGuestLayout, saveGuestLayout, directions,
} from '../utils/venueMap';
import LabLanding from '../components/LabLanding';
import VenueMapPreview from '../components/VenueMapPreview';

const TEAL = '#5EEAD4';
const VIOLET = '#8B7FFF';
const AMBER = '#F0B429';

// ─── Plan drawing (shared by editor + guest) ───────────────────────────────
function Plan({ layout, selectedId, onSelect, onMove, targetId, anchorId, facingId }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const H = planH(layout);
  const editable = !!onMove;

  const pt = (e) => {
    const svg = svgRef.current;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.max(2, Math.min(98, q.x)), y: Math.max(2, Math.min(H - 2, q.y)) };
  };
  const down = (kind, id) => (e) => {
    onSelect?.(id);
    if (!editable) return;
    dragRef.current = { kind, id };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const { x, y } = pt(e);
    onMove(d.kind, d.id, x, y);
  };
  const up = () => { dragRef.current = null; };

  const byId = (arr, id) => arr.find((x) => x.id === id);
  const anchor = byId(layout.landmarks, anchorId);
  const facing = byId(layout.landmarks, facingId);
  const target = byId(layout.tables, targetId);
  const counts = useMemo(() => {
    const c = {};
    layout.guests.forEach((g) => { c[g.tableId] = (c[g.tableId] || 0) + 1; });
    return c;
  }, [layout.guests]);

  return (
    <svg ref={svgRef} viewBox={`0 0 100 ${H}`} className="w-full rounded-2xl border border-white/10 bg-[#0a0a18] touch-none select-none"
      onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
      onClick={(e) => { if (e.target === svgRef.current) onSelect?.(null); }}>
      <defs>
        <pattern id="vm-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100" height={H} fill="url(#vm-grid)" />

      {anchor && target && (
        <line x1={anchor.x} y1={anchor.y} x2={target.x} y2={target.y} stroke={TEAL} strokeWidth="0.8" strokeDasharray="2 1.6" />
      )}
      {anchor && facing && (
        <line x1={anchor.x} y1={anchor.y} x2={anchor.x + (facing.x - anchor.x) * 0.35} y2={anchor.y + (facing.y - anchor.y) * 0.35}
          stroke={AMBER} strokeWidth="1" strokeLinecap="round" />
      )}

      {layout.tables.map((t) => {
        const sel = t.id === selectedId;
        const hit = t.id === targetId;
        return (
          <g key={t.id} onPointerDown={down('table', t.id)} style={{ cursor: editable ? 'grab' : 'default' }}>
            {hit && <circle cx={t.x} cy={t.y} r="6.5" fill="none" stroke={TEAL} strokeWidth="0.8" />}
            <circle cx={t.x} cy={t.y} r="4.2" fill={hit ? TEAL : 'rgba(139,127,255,0.22)'} stroke={sel ? '#fff' : VIOLET} strokeWidth={sel ? 0.9 : 0.5} />
            <text x={t.x} y={t.y + 1.3} textAnchor="middle" fontSize="3.6" fontWeight="700" fill={hit ? '#05050f' : '#fff'}>{t.label}</text>
            {editable && counts[t.id] > 0 && (
              <text x={t.x} y={t.y + 8.6} textAnchor="middle" fontSize="2.4" fill="rgba(255,255,255,0.5)">{counts[t.id]} guests</text>
            )}
          </g>
        );
      })}

      {layout.landmarks.map((m) => {
        const sel = m.id === selectedId;
        const isA = m.id === anchorId;
        const isF = m.id === facingId;
        return (
          <g key={m.id} onPointerDown={down('landmark', m.id)} style={{ cursor: editable ? 'grab' : 'pointer' }}>
            <rect x={m.x - 3.2} y={m.y - 3.2} width="6.4" height="6.4" rx="1.2"
              fill={isA ? AMBER : 'rgba(240,180,41,0.14)'} stroke={sel || isA ? '#fff' : AMBER} strokeWidth={sel || isA ? 0.9 : 0.5}
              transform={`rotate(45 ${m.x} ${m.y})`} />
            <text x={m.x} y={m.y + 7.4} textAnchor="middle" fontSize="2.8" fill={isA || isF ? AMBER : 'rgba(255,255,255,0.75)'}>{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#5EEAD4]';

// ─── Editor ────────────────────────────────────────────────────────────────
function Editor({ layout, setLayout, onPreview }) {
  const [selId, setSelId] = useState(null);
  const [newType, setNewType] = useState('entrance');
  const [guestText, setGuestText] = useState('');
  const [link, setLink] = useState('');
  const [qr, setQr] = useState('');
  const sel = layout.tables.find((t) => t.id === selId) || layout.landmarks.find((m) => m.id === selId);
  const isTable = !!layout.tables.find((t) => t.id === selId);
  const H = planH(layout);

  const patch = (p) => setLayout({ ...layout, ...p });
  const nextLabel = () => {
    const nums = layout.tables.map((t) => parseInt(t.label, 10)).filter(Number.isFinite);
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  };
  const addTable = () => {
    const t = { id: uid(), label: nextLabel(), x: 50, y: H / 2, seats: 8 };
    patch({ tables: [...layout.tables, t] });
    setSelId(t.id);
  };
  const addLandmark = () => {
    const m = { id: uid(), type: newType, label: LANDMARK_TYPES[newType], x: 50, y: Math.min(H - 8, 10) };
    patch({ landmarks: [...layout.landmarks, m] });
    setSelId(m.id);
  };
  const onMove = (kind, id, x, y) => {
    const key = kind === 'table' ? 'tables' : 'landmarks';
    setLayout({ ...layout, [key]: layout[key].map((i) => (i.id === id ? { ...i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : i)) });
  };
  const editSel = (p) => {
    const key = isTable ? 'tables' : 'landmarks';
    patch({ [key]: layout[key].map((i) => (i.id === selId ? { ...i, ...p } : i)) });
  };
  const removeSel = () => {
    if (isTable) patch({ tables: layout.tables.filter((t) => t.id !== selId), guests: layout.guests.filter((g) => g.tableId !== selId) });
    else patch({ landmarks: layout.landmarks.filter((m) => m.id !== selId) });
    setSelId(null);
  };

  const addGuests = () => {
    const added = [];
    const skipped = [];
    guestText.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
      const i = line.lastIndexOf(',');
      const name = (i > 0 ? line.slice(0, i) : '').trim();
      const label = (i > 0 ? line.slice(i + 1) : '').trim().replace(/^table\s*/i, '');
      const t = layout.tables.find((x) => x.label.toLowerCase() === label.toLowerCase());
      if (name && t) added.push({ id: uid(), name: name.slice(0, 40), tableId: t.id });
      else skipped.push(line);
    });
    if (added.length) patch({ guests: [...layout.guests, ...added] });
    setGuestText(skipped.join('\n'));
    if (skipped.length) toast.error(`${skipped.length} line(s) skipped \u2014 use "Name, table label" with an existing table.`);
    else if (added.length) toast.success(`${added.length} guest(s) added`);
  };

  const makeLink = async () => {
    try {
      const l = await shareLink(layout);
      setLink(l);
      const { default: QR } = await import('qrcode');
      setQr(await QR.toDataURL(l, { errorCorrectionLevel: 'L', margin: 1, width: 320 }).catch(() => ''));
      navigator.clipboard?.writeText(l).then(() => toast.success('Link copied')).catch(() => {});
    } catch { toast.error('Could not build the link.'); }
  };

  return (
    <div className="max-w-2xl mx-auto grid gap-6">
      <div className="grid grid-cols-3 gap-2">
        <input value={layout.name} onChange={(e) => patch({ name: e.target.value.slice(0, 40) })} className={`${inputCls} col-span-3`} aria-label="Venue name" />
        <label className="text-xs text-neutral-500">Width (m)
          <input type="number" min="5" max="300" value={layout.wM} onChange={(e) => patch({ wM: Math.max(5, +e.target.value || 5) })} className={`${inputCls} mt-1`} /></label>
        <label className="text-xs text-neutral-500">Depth (m)
          <input type="number" min="5" max="300" value={layout.dM} onChange={(e) => patch({ dM: Math.max(5, +e.target.value || 5) })} className={`${inputCls} mt-1`} /></label>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={addTable} className="px-3 py-2 rounded-lg text-sm font-bold text-[#05050f] flex items-center gap-1.5" style={{ background: VIOLET }}><Plus className="w-4 h-4" />Table</button>
        <div className="flex">
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="bg-white/5 border border-white/10 rounded-l-lg px-2 py-2 text-sm">
            {Object.entries(LANDMARK_TYPES).map(([k, v]) => <option key={k} value={k} className="text-black">{v}</option>)}
          </select>
          <button onClick={addLandmark} className="px-3 py-2 rounded-r-lg text-sm font-bold text-[#05050f] flex items-center gap-1.5" style={{ background: AMBER }}><Plus className="w-4 h-4" />Add</button>
        </div>
        <span className="text-[11px] text-neutral-500">Drag items to place them.</span>
      </div>

      <Plan layout={layout} selectedId={selId} onSelect={setSelId} onMove={onMove} />

      {sel && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-wrap gap-2 items-end">
          <label className="text-xs text-neutral-500 flex-1 min-w-[8rem]">{isTable ? 'Table label' : 'Landmark name'}
            <input value={sel.label} onChange={(e) => editSel({ label: e.target.value.slice(0, 20) })} className={`${inputCls} mt-1`} /></label>
          {isTable && (
            <label className="text-xs text-neutral-500 w-24">Seats
              <input type="number" min="0" max="40" value={sel.seats} onChange={(e) => editSel({ seats: +e.target.value || 0 })} className={`${inputCls} mt-1`} /></label>
          )}
          <button onClick={removeSel} className="p-2.5 rounded-lg border border-white/10 text-neutral-400 hover:text-rose-300" aria-label="Delete selected"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}

      <div>
        <h4 className="font-display font-bold mb-1">Guests</h4>
        <p className="text-xs text-neutral-500 mb-2">One per line: <span className="font-mono">Name, table label</span> ({layout.guests.length} assigned)</p>
        <textarea rows={3} value={guestText} onChange={(e) => setGuestText(e.target.value)} placeholder={'Maya Chen, 3\nDev Patel, 3'} className={inputCls} />
        <button onClick={addGuests} className="mt-2 px-3 py-2 rounded-lg border border-white/15 text-sm text-neutral-200">Add guests</button>
        {layout.guests.length > 0 && (
          <button onClick={() => patch({ guests: [] })} className="mt-2 ml-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-rose-300">Clear all</button>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h4 className="font-display font-bold mb-1">Share with guests</h4>
        <p className="text-xs text-neutral-500 mb-3">The whole layout is packed into the link itself, so any phone that opens it can find a table. Nothing is uploaded.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={makeLink} className="px-3 py-2 rounded-lg text-sm font-bold text-[#05050f] flex items-center gap-1.5" style={{ background: TEAL }}><Link2 className="w-4 h-4" />Create link + QR</button>
          <button onClick={onPreview} className="px-3 py-2 rounded-lg border border-white/15 text-sm text-neutral-200 flex items-center gap-1.5"><Navigation className="w-4 h-4" />Try guest view</button>
        </div>
        {link && (
          <div className="mt-4 text-center">
            {qr && <div className="inline-block p-3 bg-white rounded-xl"><img src={qr} alt="Layout link QR" className="w-56 h-56" /></div>}
            <p className="font-mono text-[10px] text-neutral-500 mt-2 break-all">{link.length} characters{link.length > 2200 ? ' \u2014 large; the QR may be dense, share the link instead.' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Guest ─────────────────────────────────────────────────────────────────
function GuestView({ layout, onClear }) {
  const [q, setQ] = useState('');
  const [tableId, setTableId] = useState(null);
  const [anchorId, setAnchorId] = useState(null);
  const [facingId, setFacingId] = useState(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const byGuest = layout.guests.filter((g) => g.name.toLowerCase().includes(s)).slice(0, 6)
      .map((g) => ({ key: g.id, title: g.name, tableId: g.tableId }));
    const byTable = layout.tables.filter((t) => t.label.toLowerCase() === s.replace(/^table\s*/, '')).map((t) => ({ key: t.id, title: `Table ${t.label}`, tableId: t.id }));
    return [...byGuest, ...byTable];
  }, [q, layout]);

  const table = layout.tables.find((t) => t.id === tableId);
  const anchor = layout.landmarks.find((m) => m.id === anchorId);
  const facing = layout.landmarks.find((m) => m.id === facingId);
  const text = table && anchor ? directions(layout, anchor, table, facing) : null;

  return (
    <div className="max-w-md mx-auto grid gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-2xl leading-tight">{layout.name}</h3>
          <p className="text-neutral-500 text-sm">Find your table.</p>
        </div>
        {onClear && <button onClick={onClear} className="text-xs text-neutral-500 underline shrink-0">Use a different venue</button>}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Your name or a table number" className={`${inputCls} pl-9`} />
      </div>
      {matches.length > 0 && (
        <div className="rounded-xl border border-white/10 divide-y divide-white/[0.06]">
          {matches.map((m) => {
            const t = layout.tables.find((x) => x.id === m.tableId);
            return (
              <button key={m.key} onClick={() => { setTableId(m.tableId); setQ(''); }} className="w-full text-left px-4 py-3 flex justify-between text-sm hover:bg-white/5">
                <span>{m.title}</span><span className="text-neutral-500">Table {t?.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {q && matches.length === 0 && <p className="text-sm text-neutral-500">No guest or table found.</p>}

      <Plan layout={layout} targetId={tableId} anchorId={anchorId} facingId={facingId} />

      {table && (
        <div className="grid gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold mb-2"><MapPin className="w-4 h-4" style={{ color: AMBER }} />Where are you standing?</div>
            <div className="flex flex-wrap gap-2">
              {layout.landmarks.length === 0 && <p className="text-sm text-neutral-500">This venue has no landmarks to anchor from.</p>}
              {layout.landmarks.map((m) => (
                <button key={m.id} onClick={() => { setAnchorId(m.id); if (facingId === m.id) setFacingId(null); }}
                  className={`px-3 py-1.5 rounded-full text-sm border ${m.id === anchorId ? 'bg-[#F0B429] text-[#05050f] border-transparent font-semibold' : 'border-white/15 text-neutral-300'}`}>{m.label}</button>
              ))}
            </div>
          </div>
          {anchor && layout.landmarks.length > 1 && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold mb-2"><Compass className="w-4 h-4" style={{ color: AMBER }} />What are you facing? <span className="text-neutral-500 font-normal">(optional)</span></div>
              <div className="flex flex-wrap gap-2">
                {layout.landmarks.filter((m) => m.id !== anchorId).map((m) => (
                  <button key={m.id} onClick={() => setFacingId(facingId === m.id ? null : m.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${m.id === facingId ? 'border-[#F0B429] text-[#F0B429]' : 'border-white/15 text-neutral-300'}`}>{m.label}</button>
                ))}
              </div>
            </div>
          )}
          {text && (
            <div className="rounded-xl border p-4 text-[15px] leading-relaxed" style={{ borderColor: 'rgba(94,234,212,0.35)', background: 'rgba(94,234,212,0.06)' }}>{text}</div>
          )}
        </div>
      )}
    </div>
  );
}

function LoadLink({ onLoaded }) {
  const [v, setV] = useState('');
  const go = async () => {
    try {
      const i = v.indexOf('#v=');
      const l = await decodeLayout(i >= 0 ? v.slice(i + 3).trim() : v.trim());
      onLoaded(l);
    } catch { toast.error('That doesn\u2019t look like a Venue Map link.'); }
  };
  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
        <MapIcon className="w-8 h-8 mx-auto mb-3 text-neutral-500" />
        <p className="text-sm text-neutral-300 mb-1">No venue loaded on this device.</p>
        <p className="text-xs text-neutral-500 mb-4">Open the link your host shared, or paste it here.</p>
        <div className="flex gap-2">
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Paste venue link" className={inputCls} />
          <button onClick={go} className="px-4 rounded-lg border border-white/15 text-sm text-neutral-200">Load</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function VenueMap() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('guest');
  const [mode, setMode] = useState('landing'); // landing | app
  const [draft, setDraftState] = useState(loadDraft);
  const [guestLayout, setGuestLayoutState] = useState(loadGuestLayout);

  const setDraft = useCallback((l) => { setDraftState(l); saveDraft(l); }, []);
  const setGuestLayout = useCallback((l) => { setGuestLayoutState(l); saveGuestLayout(l); }, []);

  useEffect(() => {
    layoutFromHash(window.location.hash).then((l) => {
      if (!l) { if (!loadGuestLayout()) setTab('host'); return; }
      setGuestLayout(l);
      setTab('guest');
      setMode('app');
      history.replaceState(null, '', window.location.pathname);
    }).catch(() => toast.error('This venue link is damaged.'));
  }, [setGuestLayout]);

  const tabs = [{ id: 'guest', label: 'Find my table', icon: Navigation }, { id: 'host', label: 'Build a venue', icon: PencilRuler }];

  return (
    <div className="min-h-screen bg-[#05050f] text-white" style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button onClick={() => (mode === 'app' ? setMode('landing') : navigate('/'))} className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm -ml-2 px-2 py-1.5 rounded-lg">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm">
          <MapIcon className="w-4 h-4" style={{ color: AMBER }} />Venue Map
        </div>
        <div className="w-16" />
      </div>

      {mode === 'landing' ? (
        <LabLanding
          accent={AMBER}
          headline={<>Tell it where<br />you are. It tells<br />you where to go.</>}
          body="Draw the room once and share it as a link. Guests tap the landmark they're standing next to and get plain directions to their table. No sensors, no GPS, no drift."
          primary={{ label: 'Build a venue', icon: PencilRuler, onClick: () => { setTab('host'); setMode('app'); } }}
          secondary={{ label: 'Find my table', icon: Navigation, onClick: () => { setTab('guest'); setMode('app'); } }}
          footnote="The floor plan travels inside the link, never to a server"
          preview={<VenueMapPreview />}
          steps={[
            { title: 'Draw', body: 'Drop tables and landmarks like the entrance, bar and stage onto a plan, and assign guests to tables.', icon: PencilRuler },
            { title: 'Share', body: 'The whole layout is packed into a link and QR code. Any phone that opens it has the map \u2014 nothing to install.', icon: Link2 },
            { title: 'Anchor', body: 'A guest picks their name, taps the landmark they\u2019re next to, and reads directions to their seat.', icon: MapPin },
          ]}
          notes={[
            'This is a proof of concept. Distances come from the plan you draw, so they are only as accurate as your layout.',
            'Directions are relative to a landmark the guest chooses. They do not track live movement.',
            'Large guest lists make long links. Very large events should be split into several venues.',
            'The layout you build stays in this browser; sharing the link is what gives guests a copy.',
          ]}
        />
      ) : (
      <>
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight mb-2">Tell it where you are.<br />It tells you where to go.</h1>
        <p className="text-neutral-400 text-sm max-w-md mb-6">
          No sensors, no guessing. Tap the landmark you&rsquo;re next to and get directions to your table on a plan the host drew. Runs entirely in your browser.
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
        {tab === 'host' && <Editor layout={draft} setLayout={setDraft} onPreview={() => { setGuestLayout(draft); setTab('guest'); }} />}
        {tab === 'guest' && (guestLayout
          ? <GuestView layout={guestLayout} onClear={() => setGuestLayout(null)} />
          : <LoadLink onLoaded={setGuestLayout} />)}
      </div>
      </>
      )}
    </div>
  );
}
