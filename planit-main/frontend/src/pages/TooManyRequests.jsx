/**
 * frontend/src/pages/TooManyRequests.jsx
 *
 * The 429 page. Two things changed from the old version:
 *
 * 1. VISUAL REFRESH — same brand system (Syne display font, black/white,
 *    pill badges) as NotFound.jsx, but with a proper radial-glow header,
 *    a real "block card" instead of a bare number, and a live progress
 *    ring instead of a thin bar.
 *
 * 2. REAL TIMESTAMPS, NOT JUST A COUNTDOWN — the old page only ever showed
 *    a decrementing integer seeded from `retryAfter`, seeded from a
 *    `setInterval` that ticks a counter down once a second. Two problems
 *    with that: (a) it never showed *when* the block happened or *when* it
 *    actually lifts, just "N seconds from whenever this component mounted",
 *    and (b) a plain `setInterval` counter drifts/pauses if the tab is
 *    backgrounded (browsers throttle timers in inactive tabs), so the
 *    number can lag behind the real unblock time.
 *
 *    Fixed by computing two real Date objects up front —
 *      blockedAt  = when the 429 actually happened (passed in from the
 *                   caller via router state; see EventSpace.jsx /
 *                   RSVPEventDashboard.jsx, which now capture
 *                   `Date.now()` at the moment they catch the 429, not
 *                   whenever this page happens to mount)
 *      unblocksAt = blockedAt + retryAfter (from the response's real
 *                   `Retry-After` header, in seconds)
 *    — and re-deriving the countdown every tick as
 *      `unblocksAt - Date.now()`
 *    instead of decrementing a counter. That means the displayed time is
 *    always correct relative to the wall clock even after a backgrounded
 *    tab, and both "Blocked at" and "Unblocks at" are shown as real
 *    local-time clock strings, not just a bare number of seconds.
 *
 * Router-state contract (see call sites in EventSpace.jsx and
 * RSVPEventDashboard.jsx):
 *   { retryAfter: <seconds:number>, blockedAt: <ms epoch:number>, returnTo: <path:string> }
 * `blockedAt` is optional — if a call site doesn't pass it (or if someone
 * lands here directly), it falls back to "now" so the page still works,
 * it just can't show a fully accurate "blocked at" moment for a block
 * that technically started slightly earlier.
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

const clockFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function TooManyRequests() {
  const navigate = useNavigate();
  const location = useLocation();

  const retryAfterSec = Number.isFinite(location.state?.retryAfter) ? location.state.retryAfter : 60;
  const returnTo       = location.state?.returnTo || null;

  // Real wall-clock anchors — computed once, not re-derived on every render.
  const blockedAt = useMemo(() => location.state?.blockedAt || Date.now(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const unblocksAt = useMemo(() => blockedAt + retryAfterSec * 1000, [blockedAt, retryAfterSec]);

  const [msLeft, setMsLeft] = useState(Math.max(0, unblocksAt - Date.now()));
  const canRetry = msLeft <= 0;

  useEffect(() => {
    if (canRetry) return;
    // Re-derive from real timestamps every tick — immune to tab throttling.
    const id = setInterval(() => setMsLeft(Math.max(0, unblocksAt - Date.now())), 250);
    return () => clearInterval(id);
  }, [unblocksAt, canRetry]);

  const secondsLeft = Math.ceil(msLeft / 1000);
  const pct = retryAfterSec > 0 ? Math.min(100, Math.max(0, ((retryAfterSec * 1000 - msLeft) / (retryAfterSec * 1000)) * 100) ) : 100;

  const handleRetry = () => {
    if (returnTo) navigate(returnTo, { replace: true });
    else navigate(-1);
  };

  // Ring geometry
  const R = 54, C = 2 * Math.PI * R;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f8", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <nav style={navStyle}>
        <Link to="/" style={logoStyle}>PlanIt</Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/help"   style={navLinkStyle}>Help Center</Link>
          <Link to="/status" style={navLinkStyle}>Status</Link>
          <Link to="/"       style={{ ...navLinkStyle, background: "#0a0a0a", color: "#fff", border: "1px solid #0a0a0a" }}>Go Home</Link>
        </div>
      </nav>

      {/* Glow header */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)",
          width: 520, height: 360, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0) 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 24px 40px", position: "relative" }}>
          <div style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>

            <div style={pillStyle}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: canRetry ? "none" : "pulse429 1.4s ease-in-out infinite" }} />
              <span style={pillTextStyle}>{canRetry ? "Limit lifted" : "429 · Rate Limited"}</span>
            </div>

            <div style={{ fontSize: "clamp(64px,16vw,120px)", fontWeight: 900, lineHeight: 1, color: "#0a0a0a", fontFamily: "Syne,sans-serif", letterSpacing: "-0.04em", marginBottom: 14 }}>
              429
            </div>

            <h1 style={h1Style}>Slow down — too many requests</h1>

            <p style={pStyle}>
              You've hit the request limit, usually from repeated rapid refreshes or high activity.
              Give it a moment — your data is safe and nothing was lost.
            </p>

            {/* Block card — the actual new content */}
            <div style={blockCardStyle}>
              <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
                <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="66" cy="66" r={R} fill="none" stroke="#f0f0f0" strokeWidth="8" />
                  <circle
                    cx="66" cy="66" r={R} fill="none"
                    stroke={canRetry ? "#22c55e" : "#f59e0b"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C - (pct / 100) * C}
                    style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontSize: canRetry ? 15 : 30, fontWeight: 900, color: "#0a0a0a", fontFamily: "Syne,sans-serif", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {canRetry ? "✓" : secondsLeft}
                  </span>
                  {!canRetry && <span style={{ fontSize: 10, fontWeight: 700, color: "#aaa", letterSpacing: "0.08em", marginTop: 4 }}>SEC LEFT</span>}
                </div>
              </div>

              <div style={{ textAlign: "left", flex: 1, minWidth: 180 }}>
                <TimeRow label="Blocked at" value={clockFmt.format(blockedAt)} />
                <TimeRow label={canRetry ? "Unblocked at" : "Unblocks at"} value={clockFmt.format(unblocksAt)} accent={canRetry} />
                <TimeRow label="Duration" value={`${retryAfterSec}s`} />
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
              <button
                onClick={handleRetry}
                disabled={!canRetry}
                style={{ ...btnPrimaryStyle, opacity: canRetry ? 1 : 0.4, cursor: canRetry ? "pointer" : "not-allowed", background: canRetry ? "#0a0a0a" : "#888" }}
              >
                {canRetry ? "Try again" : `Wait ${secondsLeft}s…`}
              </button>
              <Link to="/" style={btnSecondaryStyle}>Back to home</Link>
              <Link to="/status" style={btnSecondaryStyle}>Check status</Link>
            </div>

            {/* Support */}
            <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 40 }}>
              <p style={eyebrowStyle}>Still seeing this?</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                <SupportCard title="Status page"   desc="Check for service issues"  href="/status" />
                <SupportCard title="Email support" desc="planit.userhelp@gmail.com" href="mailto:planit.userhelp@gmail.com" />
                <SupportCard title="Help center"   desc="Guides & documentation"    href="/help" />
              </div>
            </div>

          </div>
        </div>
      </div>

      <footer style={footerStyle}>
        © {new Date().getFullYear()} PlanIt ·{" "}
        <Link to="/help" style={footerLinkStyle}>Help</Link> ·{" "}
        <Link to="/privacy" style={footerLinkStyle}>Privacy</Link> ·{" "}
        <Link to="/status" style={footerLinkStyle}>Status</Link>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        @keyframes pulse429 { 0%,100%{opacity:1} 50%{opacity:0.25} }
      `}</style>
    </div>
  );
}

function TimeRow({ label, value, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#999" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: accent ? "#15803d" : "#0a0a0a", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function SupportCard({ title, desc, href }) {
  return (
    <a href={href} style={cardStyle}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#0a0a0a"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>{title}</span>
      <span style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{desc}</span>
    </a>
  );
}

const navStyle = { background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 };
const logoStyle = { fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 20, color: "#0a0a0a", textDecoration: "none", letterSpacing: "-0.02em" };
const navLinkStyle = { fontSize: 13, fontWeight: 600, color: "#444", textDecoration: "none", padding: "7px 14px", borderRadius: 10, border: "1px solid #e5e5e5", background: "transparent" };
const pillStyle = { display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 100, padding: "6px 16px", marginBottom: 28 };
const pillTextStyle = { fontSize: 12, fontWeight: 700, color: "#6b6b6b", letterSpacing: "0.08em", textTransform: "uppercase" };
const h1Style = { fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#0a0a0a", marginBottom: 12, fontFamily: "Syne,sans-serif", letterSpacing: "-0.02em" };
const pStyle = { fontSize: 15, color: "#6b6b6b", lineHeight: 1.65, maxWidth: 420, margin: "0 auto 32px" };
const blockCardStyle = { display: "flex", alignItems: "center", gap: 28, justifyContent: "center", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 20, padding: "24px 28px", marginBottom: 40, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" };
const eyebrowStyle = { fontSize: 12, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 };
const cardStyle = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "16px 18px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 14, textDecoration: "none", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left" };
const footerStyle = { textAlign: "center", padding: "24px", borderTop: "1px solid #e5e5e5", fontSize: 12, color: "#bbb" };
const footerLinkStyle = { color: "#aaa", textDecoration: "none" };
const btnPrimaryStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", background: "#0a0a0a", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", border: "none", fontFamily: "inherit" };
const btnSecondaryStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", background: "#fff", color: "#0a0a0a", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1px solid #e5e5e5", cursor: "pointer", fontFamily: "inherit" };
