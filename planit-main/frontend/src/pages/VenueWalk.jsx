import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Compass, Navigation, Footprints, MapPin, MapPinned, Plus, Trash2,
  Pencil, CheckCircle2, AlertTriangle, ChevronRight, CameraOff,
  Loader2, Sparkles, Lock, ShieldAlert, Monitor, Radar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useVenueCamera, usePositionTracker, motionSensorsSupported,
  bearingTo, distanceBetween, bearingLabel, relativeBearing, formatDistance,
  saveVenueLayout, loadVenueLayout, listSavedVenues,
} from '../utils/venueWalk';

// A guest is considered "arrived" once dead-reckoned distance drops below
// this — close enough that remaining drift makes a finer number meaningless,
// same reasoning as formatDistance()'s own "Arrived" cutoff.
const ARRIVAL_THRESHOLD_M = 1.2;

// Floor-plan fallback canvas scale.
const PIXELS_PER_METER = 26;

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CHROME
// ═══════════════════════════════════════════════════════════════════════════
function BetaBar() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-amber-400/20 bg-amber-400/[0.06]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[11px] font-mono tracking-wide text-amber-300/90 flex-1">
          BETA DEMO &mdash; dead-reckoning, not GPS or true AR anchoring
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-amber-400/60 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 -mt-0.5 text-[12px] leading-relaxed text-neutral-400 max-w-2xl">
          Venue Walk estimates position by counting steps and reading your phone&rsquo;s
          compass &mdash; it never uses GPS and there&rsquo;s no true AR anchoring under the
          arrow. Every step compounds a small amount of error onto the last one, so drift
          grows the farther you walk from the start point. Treat the arrow and distance as
          an estimate, not precision positioning &mdash; the same honest framing Face Ticket
          uses for its liveness check. Nothing recorded here (steps, heading, table
          positions) ever leaves your browser&rsquo;s storage; there\u2019s no server call
          anywhere in this feature.
        </div>
      )}
    </div>
  );
}

function PageChrome({ onBack, children }) {
  return (
    <div
      className="min-h-screen bg-[#05050f] text-white flex flex-col"
      style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}
    >
      <BetaBar />
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-400 hover:text-white active:text-white transition-colors text-sm -ml-2 px-2 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm">
          <Compass className="w-4 h-4 text-[#8B7FFF]" />
          Venue Walk
        </div>
        <div className="w-16" />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE ELEMENT — animated compass preview (decorative, landing page)
// ═══════════════════════════════════════════════════════════════════════════
function CompassPreview() {
  const [heading, setHeading] = useState(24);
  useEffect(() => {
    const id = setInterval(() => setHeading((h) => (h + 7) % 360), 700);
    return () => clearInterval(id);
  }, []);
  const diff = relativeBearing(heading, 0);
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">Live readout</span>
        <Radar className="w-4 h-4 text-neutral-600" />
      </div>
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 rounded-full border border-white/10 bg-black/40 flex items-center justify-center shrink-0">
          <Navigation
            className="w-10 h-10 text-[#8B7FFF] transition-transform duration-500 ease-out"
            style={{ transform: `rotate(${diff}deg)` }}
          />
          <span className="absolute inset-0 rounded-full border border-[#8B7FFF]/20 animate-ping" />
        </div>
        <div>
          <div className="font-display font-bold text-2xl">32 ft</div>
          <div className="text-neutral-500 text-xs mb-3">Table 14 &middot; bear left</div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-teal-400/80">
            <Footprints className="w-3 h-3" />
            41 steps tracked
          </div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-neutral-500">
        <span>step + heading &rarr; x, y</span>
        <span className="text-teal-400/80">no GPS</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════════════════════
function LandingScreen({ onSetup, onFind }) {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[#8B7FFF] uppercase mb-5">
            <Sparkles className="w-3 h-3" />
            PlanIt Labs &middot; Experimental
          </div>
          <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[1.03] tracking-tight mb-5">
            Walk it once.<br />Guide every guest.
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-md mb-8">
            Record your tables by walking the room one time &mdash; no floor plan software,
            no GPS, no server. Then hand guests a live arrow and distance readout that
            walks them straight to their seat.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              onClick={onSetup}
              className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm hover:bg-[#9d92ff] transition-colors"
            >
              <Footprints className="w-4 h-4" />
              Set Up Tables
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onFind}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              <Navigation className="w-4 h-4" />
              Find My Table
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-neutral-500 font-mono">
            <Lock className="w-3.5 h-3.5" />
            Table positions never leave this device
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-[#8B7FFF]/10 blur-3xl rounded-full" />
          <div className="relative">
            <CompassPreview />
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-24 sm:mt-32 grid sm:grid-cols-3 gap-6 sm:gap-8">
        {[
          { n: '01', title: 'Walk', body: 'Standing at the entrance, start tracking, then walk to each table and drop a pin. Your phone counts steps and reads its compass.', icon: Footprints },
          { n: '02', title: 'Save', body: 'Table names and positions are saved as plain {x, y} coordinates, right in this browser \u2014 nothing is uploaded anywhere.', icon: MapPinned },
          { n: '03', title: 'Guide', body: 'A guest picks their table, stands at the same entrance, and follows a live arrow and distance readout to their seat.', icon: Navigation },
        ].map((step) => (
          <div key={step.n}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs text-[#8B7FFF]">{step.n}</span>
              <step.icon className="w-4 h-4 text-neutral-500" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1.5">{step.title}</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer panel */}
      <div className="mt-20 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="font-display font-bold text-sm">Read before you try it</span>
        </div>
        <ul className="space-y-2 text-sm text-neutral-400 leading-relaxed">
          <li>&bull; This is dead-reckoning (steps + compass), not GPS and not true AR anchoring.</li>
          <li>&bull; Error compounds with distance walked &mdash; the farther from the start point, the less precise the arrow gets.</li>
          <li>&bull; Both directions start from the exact same spot &mdash; pick a fixed landmark (a door, a host stand) as your anchor.</li>
          <li>&bull; No motion sensor data or table position is ever sent to a server; everything lives in this browser.</li>
          <li>&bull; No motion sensors on this device or browser? A click-to-place floor plan fallback appears automatically.</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED BITS — anchor prompt, table list, arrow overlay
// ═══════════════════════════════════════════════════════════════════════════
function Field({ label, children }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function AnchorNotice() {
  return (
    <div className="flex items-start gap-2 text-sm text-[#8B7FFF] bg-[#8B7FFF]/10 border border-[#8B7FFF]/20 rounded-lg px-3 py-2.5 mb-4">
      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
      Stand at your fixed start point (the door, the host stand) before you start tracking.
    </div>
  );
}

function TableList({ tables, onDelete, onRename, emptyHint }) {
  if (!tables.length) {
    return <p className="text-neutral-600 text-sm text-center py-6">{emptyHint}</p>;
  }
  return (
    <div className="space-y-2">
      {tables.map((t, i) => (
        <div key={`${t.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
          <span className="w-7 h-7 rounded-lg bg-[#8B7FFF]/15 flex items-center justify-center shrink-0">
            <MapPin className="w-3.5 h-3.5 text-[#8B7FFF]" />
          </span>
          <span className="flex-1 min-w-0 truncate text-sm font-medium">{t.name}</span>
          <span className="font-mono text-[10px] text-neutral-600 shrink-0">
            {Math.round(t.x)}, {Math.round(t.y)}m
          </span>
          {onRename && (
            <button onClick={() => onRename(i)} className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(i)} className="p-1.5 rounded-md text-neutral-500 hover:text-rose-300 hover:bg-rose-400/10 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Arrow rotated to point from the current heading toward the target
 *  bearing, plus the live distance/steering text. Shared between the camera
 *  overlay and (in a static form) the floor-plan fallback. */
function ArrowReadout({ heading, targetBearing, distanceM, big }) {
  const arrived = distanceM <= ARRIVAL_THRESHOLD_M;
  const diff = heading == null ? 0 : relativeBearing(heading, targetBearing);
  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${big ? 'w-40 h-40' : 'w-28 h-28'} rounded-full border-2 flex items-center justify-center mb-4 ${
        arrived ? 'border-teal-400/60 bg-teal-400/10' : 'border-[#8B7FFF]/40 bg-[#8B7FFF]/5'
      }`}>
        {arrived ? (
          <CheckCircle2 className={`${big ? 'w-16 h-16' : 'w-11 h-11'} text-teal-300 animate-[pulse_1.4s_ease-in-out_infinite]`} />
        ) : (
          <Navigation
            className={`${big ? 'w-16 h-16' : 'w-11 h-11'} text-[#8B7FFF] transition-transform duration-300 ease-out`}
            style={{ transform: `rotate(${diff}deg)` }}
          />
        )}
      </div>
      <div className="font-display font-extrabold text-3xl mb-1">
        {arrived ? 'Arrived' : formatDistance(distanceM)}
      </div>
      {!arrived && (
        <div className="text-neutral-500 text-sm">{heading == null ? 'Reading compass\u2026' : bearingLabel(heading, targetBearing)}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOOR PLAN FALLBACK — click-to-place, used when motion sensors aren't
// available (feature-detected, never user-agent sniffed). Same {name,x,y}
// data shape as the physical walk, so Setup/Find work identically either
// way once a layout is saved.
// ═══════════════════════════════════════════════════════════════════════════
function FloorPlanCanvas({ anchor, tables, highlightIndex, onCanvasClick, cursorLabel }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: Math.max(320, el.clientWidth * 0.62) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toPixel = useCallback((pt) => ({
    x: size.w / 2 + pt.x * PIXELS_PER_METER,
    y: size.h / 2 - pt.y * PIXELS_PER_METER,
  }), [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size.w, size.h);

    // Faint grid, purely decorative.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = size.w / 2 % PIXELS_PER_METER; x < size.w; x += PIXELS_PER_METER) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size.h); ctx.stroke();
    }
    for (let y = size.h / 2 % PIXELS_PER_METER; y < size.h; y += PIXELS_PER_METER) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size.w, y); ctx.stroke();
    }

    if (anchor) {
      const p = toPixel(anchor);
      // Highlighted line from the anchor to the selected table, if any.
      if (highlightIndex != null && tables[highlightIndex]) {
        const target = toPixel(tables[highlightIndex]);
        ctx.strokeStyle = 'rgba(139,127,255,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#5EEAD4';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px sans-serif';
      ctx.fillText('Start', p.x + 10, p.y - 8);
    }

    tables.forEach((t, i) => {
      const p = toPixel(t);
      const active = i === highlightIndex;
      ctx.fillStyle = active ? '#8B7FFF' : 'rgba(139,127,255,0.55)';
      ctx.beginPath(); ctx.arc(p.x, p.y, active ? 8 : 6, 0, Math.PI * 2); ctx.fill();
      if (active) {
        ctx.strokeStyle = 'rgba(139,127,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#e5e7eb';
      ctx.font = active ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.fillText(t.name, p.x + 10, p.y + 4);
    });
  }, [anchor, tables, highlightIndex, size, toPixel]);

  const handleClick = (e) => {
    if (!onCanvasClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Inverse of toPixel(): pixel -> meters, relative to the anchor at
    // (size.w/2, size.h/2). Screen-up is +y (north/forward), screen-right
    // is +x (east/right) — matching the same x=sin, y=cos convention the
    // physical dead-reckoning tracker uses, so both data sources are
    // interchangeable.
    const x = (px - size.w / 2) / PIXELS_PER_METER;
    const y = (size.h / 2 - py) / PIXELS_PER_METER;
    onCanvasClick({ x, y });
  };

  return (
    <div ref={wrapRef} className="w-full">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className={`w-full rounded-xl border border-white/10 bg-black/40 ${onCanvasClick ? 'cursor-crosshair' : ''}`}
      />
      {cursorLabel && <p className="text-center text-neutral-600 text-xs mt-2">{cursorLabel}</p>}
    </div>
  );
}

function FloorPlanSetup({ venueName, onFinish, onCancel }) {
  const [anchor, setAnchor] = useState(null);
  const [tables, setTables] = useState([]);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [nameInput, setNameInput] = useState('');

  const handleClick = (pt) => {
    if (!anchor) {
      setAnchor(pt);
      toast.success('Start point set');
      return;
    }
    setPendingPoint(pt);
    setNameInput(`Table ${tables.length + 1}`);
  };

  const confirmTable = () => {
    if (!nameInput.trim()) return;
    setTables((t) => [...t, { name: nameInput.trim(), x: pendingPoint.x, y: pendingPoint.y }]);
    setPendingPoint(null);
    setNameInput('');
  };

  const finish = () => {
    if (!tables.length) {
      toast.error('Drop at least one table pin first');
      return;
    }
    const ok = saveVenueLayout(venueName, tables);
    if (ok) onFinish(tables);
    else toast.error('Could not save this layout on this device');
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1.5 font-mono uppercase tracking-widest">
        <Monitor className="w-3.5 h-3.5" />
        No motion sensors detected &middot; floor plan mode
      </div>
      <h2 className="font-display font-bold text-2xl mb-1.5">Click to place tables</h2>
      <p className="text-neutral-500 text-sm mb-6">
        First click sets your start point. Every click after that drops a table pin.
      </p>

      <FloorPlanCanvas
        anchor={anchor}
        tables={tables}
        onCanvasClick={handleClick}
        cursorLabel={anchor ? 'Click anywhere to add the next table' : 'Click once to set the start point'}
      />

      {pendingPoint && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Field label="Table name">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmTable()}
              maxLength={28}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm mb-3"
            />
          </Field>
          <div className="flex gap-2">
            <button onClick={confirmTable} className="flex-1 py-2.5 rounded-lg bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">Add table</button>
            <button onClick={() => setPendingPoint(null)} className="px-4 py-2.5 rounded-lg border border-white/15 text-sm text-neutral-300">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <TableList
          tables={tables}
          onDelete={(i) => setTables((t) => t.filter((_, idx) => idx !== i))}
          emptyHint="No tables placed yet."
        />
      </div>

      <div className="flex flex-col gap-3 mt-8">
        <button onClick={finish} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Finish setup
        </button>
        <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  );
}

function FloorPlanFind({ layout, table, onExit }) {
  const idx = layout.tables.findIndex((t) => t.name === table.name);
  const distanceM = distanceBetween({ x: 0, y: 0 }, table);
  const bearing = bearingTo({ x: 0, y: 0 }, table);
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1.5 font-mono uppercase tracking-widest">
        <Monitor className="w-3.5 h-3.5" />
        No motion sensors detected &middot; floor plan mode
      </div>
      <h2 className="font-display font-bold text-2xl mb-1.5">{table.name}</h2>
      <p className="text-neutral-500 text-sm mb-6">
        From the start point: {formatDistance(distanceM)}, bearing {Math.round(bearing)}&deg;.
      </p>
      <FloorPlanCanvas anchor={{ x: 0, y: 0 }} tables={layout.tables} highlightIndex={idx} />
      <button onClick={onExit} className="w-full mt-8 py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Done</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP MODE (physical walk)
// ═══════════════════════════════════════════════════════════════════════════
function CameraStage({ videoRef, ready, error, onRetry, overlay, modelBadge }) {
  return (
    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
          <CameraOff className="w-10 h-10 text-rose-400 mb-3" />
          <p className="text-sm text-neutral-300 mb-4">{error}</p>
          <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold">Retry camera</button>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!ready && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-[#8B7FFF] animate-spin" />
            </div>
          )}
          {overlay}
          {modelBadge}
        </>
      )}
    </div>
  );
}

function SetupWalk({ venueName, onFinish, onCancel, onSensorsUnavailable }) {
  const camera = useVenueCamera();
  const tracker = usePositionTracker({ onUnavailable: onSensorsUnavailable });
  const [started, setStarted] = useState(false);
  const [tables, setTables] = useState([]);
  const [naming, setNaming] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    // Must run from this click (a user gesture) — the iOS permission
    // prompt for motion/orientation only appears when requested this way.
    await tracker.start();
    setStarted(true);
  };

  const dropTable = () => {
    setNameInput(`Table ${tables.length + 1}`);
    setNaming(true);
  };

  const confirmTable = () => {
    if (!nameInput.trim()) return;
    setTables((t) => [...t, { name: nameInput.trim(), x: tracker.position.x, y: tracker.position.y }]);
    setNaming(false);
    setNameInput('');
  };

  const finish = () => {
    if (!tables.length) {
      toast.error('Drop at least one table pin first');
      return;
    }
    tracker.stop();
    camera.stop();
    const ok = saveVenueLayout(venueName, tables);
    if (ok) onFinish(tables);
    else toast.error('Could not save this layout on this device');
  };

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Walk the venue</h2>
      <p className="text-neutral-500 text-sm mb-4">
        {started ? 'Walk to each table and drop a pin when you get there.' : 'Stand at your fixed start point, then start tracking.'}
      </p>

      {!started && <AnchorNotice />}

      <CameraStage
        videoRef={camera.videoRef}
        ready={camera.ready}
        error={camera.error}
        onRetry={camera.start}
        overlay={started && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-3 flex items-center justify-between font-mono text-[11px] text-neutral-300">
            <span className="flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5 text-[#8B7FFF]" />{tracker.stepCount} steps</span>
            <span>{tracker.heading == null ? 'no heading' : `${Math.round(tracker.heading)}\u00b0`}</span>
          </div>
        )}
      />

      {tracker.error && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Lost the motion sensors mid-walk. Switching to the floor plan fallback.
        </div>
      )}

      {!started ? (
        <button
          onClick={begin}
          disabled={!camera.ready}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 mb-3"
        >
          <Radar className="w-4 h-4" />
          Start tracking
        </button>
      ) : (
        <button
          onClick={dropTable}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm mb-3"
        >
          <Plus className="w-4 h-4" />
          Drop table here
        </button>
      )}

      {tables.length > 0 && (
        <div className="mb-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-2">Placed so far</span>
          <TableList tables={tables} onDelete={(i) => setTables((t) => t.filter((_, idx) => idx !== i))} emptyHint="" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {started && (
          <button onClick={finish} className="w-full py-3 rounded-xl border border-teal-400/30 bg-teal-400/10 text-teal-300 font-semibold text-sm">
            Finish setup
          </button>
        )}
        <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
      </div>

      {naming && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0714] p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-3">Name this table</span>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmTable()}
              maxLength={28}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button onClick={confirmTable} className="flex-1 py-2.5 rounded-lg bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">Add</button>
              <button onClick={() => setNaming(false)} className="px-4 py-2.5 rounded-lg border border-white/15 text-sm text-neutral-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VenueNameStep({ onNext, onCancel, title, subtitle }) {
  const [name, setName] = useState('');
  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">{title}</h2>
      <p className="text-neutral-500 text-sm mb-6">{subtitle}</p>
      <Field label="Venue / event name">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Founders' Night"
          maxLength={40}
          className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm mb-8"
        />
      </Field>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => name.trim() && onNext(name.trim())}
          disabled={!name.trim()}
          className="w-full py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40"
        >
          Continue
        </button>
        <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
      </div>
    </div>
  );
}

function SetupDone({ venueName, tables, onExit }) {
  return (
    <div className="max-w-md mx-auto px-5 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-teal-400/15 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-8 h-8 text-teal-300" />
      </div>
      <h2 className="font-display font-bold text-2xl mb-1.5">Layout saved</h2>
      <p className="text-neutral-500 text-sm mb-8">{venueName} &middot; {tables.length} table{tables.length === 1 ? '' : 's'}</p>
      <TableList tables={tables} emptyHint="" />
      <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mt-6 mb-8 justify-center">
        <Lock className="w-3.5 h-3.5" />
        Saved only on this device
      </div>
      <button onClick={onExit} className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm">Done</button>
    </div>
  );
}

function SetupFlow({ onDone }) {
  const [step, setStep] = useState('name'); // name -> walk -> floorplan -> done
  const [venueName, setVenueName] = useState('');
  const [savedTables, setSavedTables] = useState([]);

  // If this device/browser has no motion sensors at all, skip the camera
  // walk entirely rather than showing a UI that can never work — feature
  // detection, not user-agent sniffing.
  const startWalkStep = () => setStep(motionSensorsSupported() ? 'walk' : 'floorplan');

  if (step === 'name') {
    return (
      <VenueNameStep
        title="Name this venue"
        subtitle="Used to save and later find this table layout on this device."
        onNext={(name) => { setVenueName(name); startWalkStep(); }}
        onCancel={onDone}
      />
    );
  }
  if (step === 'walk') {
    return (
      <SetupWalk
        venueName={venueName}
        onFinish={(tables) => { setSavedTables(tables); setStep('done'); }}
        onCancel={onDone}
        onSensorsUnavailable={() => setStep('floorplan')}
      />
    );
  }
  if (step === 'floorplan') {
    return (
      <FloorPlanSetup
        venueName={venueName}
        onFinish={(tables) => { setSavedTables(tables); setStep('done'); }}
        onCancel={onDone}
      />
    );
  }
  return <SetupDone venueName={venueName} tables={savedTables} onExit={onDone} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIND MODE (physical walk)
// ═══════════════════════════════════════════════════════════════════════════
function VenuePicker({ onPick, onCancel }) {
  const venues = useMemo(() => listSavedVenues(), []);
  if (!venues.length) {
    return (
      <div className="max-w-md mx-auto px-5 py-10 text-center">
        <MapPinned className="w-10 h-10 text-neutral-700 mx-auto mb-4" />
        <p className="text-neutral-400 text-sm mb-6">No table layouts saved on this device yet. Set up tables first.</p>
        <button onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-white/15 text-sm text-neutral-300">Back</button>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Which venue?</h2>
      <p className="text-neutral-500 text-sm mb-6">Layouts saved on this device.</p>
      <div className="space-y-2 mb-8">
        {venues.map((v) => (
          <button
            key={v.venueId}
            onClick={() => onPick(v.venueId)}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 hover:bg-white/[0.06] text-left"
          >
            <MapPinned className="w-4 h-4 text-[#8B7FFF] shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium">{v.venueId}</span>
            <span className="font-mono text-[11px] text-neutral-500 shrink-0">{v.tableCount} tables</span>
            <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
    </div>
  );
}

function TablePicker({ layout, onPick, onCancel }) {
  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Which table?</h2>
      <p className="text-neutral-500 text-sm mb-6">You&rsquo;ll be guided from the same start point used during setup.</p>
      <div className="space-y-2 mb-8">
        {layout.tables.map((t, i) => (
          <button
            key={`${t.name}-${i}`}
            onClick={() => onPick(t)}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 hover:bg-white/[0.06] text-left"
          >
            <MapPin className="w-4 h-4 text-[#8B7FFF] shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium">{t.name}</span>
            <ChevronRight className="w-4 h-4 text-neutral-600 shrink-0" />
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Back</button>
    </div>
  );
}

function FindWalk({ table, onDone, onCancel, onSensorsUnavailable }) {
  const camera = useVenueCamera();
  const tracker = usePositionTracker({ onUnavailable: onSensorsUnavailable });
  const [started, setStarted] = useState(false);

  useEffect(() => {
    camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    await tracker.start();
    setStarted(true);
  };

  const distanceM = distanceBetween(tracker.position, table);
  const bearing = bearingTo(tracker.position, table);
  const arrived = distanceM <= ARRIVAL_THRESHOLD_M;

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Finding {table.name}</h2>
      <p className="text-neutral-500 text-sm mb-4">
        {started ? 'Follow the arrow.' : 'Stand at the exact spot setup started from, then start tracking.'}
      </p>

      {!started && <AnchorNotice />}

      <CameraStage
        videoRef={camera.videoRef}
        ready={camera.ready}
        error={camera.error}
        onRetry={camera.start}
        overlay={started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/25">
            <ArrowReadout heading={tracker.heading} targetBearing={bearing} distanceM={distanceM} big />
          </div>
        )}
      />

      {!started ? (
        <button
          onClick={begin}
          disabled={!camera.ready}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 mb-3"
        >
          <Radar className="w-4 h-4" />
          Start tracking
        </button>
      ) : arrived ? (
        <button onClick={onDone} className="w-full py-3.5 rounded-xl bg-teal-400 text-[#0a0714] font-bold text-sm mb-3">
          You&rsquo;re here
        </button>
      ) : null}

      <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
    </div>
  );
}

function FindFlow({ onDone }) {
  const [step, setStep] = useState('venue'); // venue -> table -> walk -> floorplan -> arrived
  const [layout, setLayout] = useState(null);
  const [table, setTable] = useState(null);

  if (step === 'venue') {
    return (
      <VenuePicker
        onPick={(venueId) => {
          const data = loadVenueLayout(venueId);
          if (!data) { toast.error('Could not load that layout'); return; }
          setLayout({ venueId, ...data });
          setStep('table');
        }}
        onCancel={onDone}
      />
    );
  }
  if (step === 'table') {
    return (
      <TablePicker
        layout={layout}
        onPick={(t) => {
          setTable(t);
          setStep(motionSensorsSupported() ? 'walk' : 'floorplan');
        }}
        onCancel={() => setStep('venue')}
      />
    );
  }
  if (step === 'walk') {
    return (
      <FindWalk
        table={table}
        onDone={onDone}
        onCancel={onDone}
        onSensorsUnavailable={() => setStep('floorplan')}
      />
    );
  }
  if (step === 'floorplan') {
    return <FloorPlanFind layout={layout} table={table} onExit={onDone} />;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function VenueWalk() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('landing'); // landing | setup | find

  const handleBack = () => {
    if (mode === 'landing') navigate('/');
    else setMode('landing');
  };

  return (
    <PageChrome onBack={handleBack}>
      {mode === 'landing' && (
        <LandingScreen onSetup={() => setMode('setup')} onFind={() => setMode('find')} />
      )}
      {mode === 'setup' && <SetupFlow onDone={() => setMode('landing')} />}
      {mode === 'find' && <FindFlow onDone={() => setMode('landing')} />}
    </PageChrome>
  );
}
