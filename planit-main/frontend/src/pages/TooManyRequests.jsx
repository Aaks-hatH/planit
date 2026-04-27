import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function TooManyRequests() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // Retry-After may be passed via router state (in seconds)
  const retryAfter = location.state?.retryAfter || 60;
  const [secondsLeft, setSecondsLeft] = useState(retryAfter);
  const [canRetry, setCanRetry]       = useState(retryAfter <= 0);
  const returnTo = location.state?.returnTo || null;

  useEffect(() => {
    if (retryAfter <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(interval); setCanRetry(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfter]);

  const handleRetry = () => {
    if (returnTo) navigate(returnTo, { replace: true });
    else navigate(-1);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8f8f8", display: "flex", flexDirection: "column" }}>
      {/* Navbar */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e5e5e5", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <Link to="/" style={{ fontFamily: "Syne,sans-serif", fontWeight: 800, fontSize: 20, color: "#0a0a0a", textDecoration: "none", letterSpacing: "-0.02em" }}>PlanIt</Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/help"   style={navLinkStyle}>Help Center</Link>
          <Link to="/status" style={navLinkStyle}>Status</Link>
          <Link to="/"       style={{ ...navLinkStyle, background: "#0a0a0a", color: "#fff", border: "1px solid #0a0a0a" }}>Go Home</Link>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>

          {/* Error pill */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 100, padding: "6px 16px", marginBottom: 32 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse429 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b6b6b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              429 · Rate Limited
            </span>
          </div>

          {/* Big 429 */}
          <div style={{ fontSize: "clamp(80px,20vw,140px)", fontWeight: 900, lineHeight: 1, color: "#0a0a0a", fontFamily: "Syne,sans-serif", letterSpacing: "-0.04em", marginBottom: 16 }}>
            429
          </div>

          <h1 style={{ fontSize: "clamp(20px,4vw,28px)", fontWeight: 800, color: "#0a0a0a", marginBottom: 12, fontFamily: "Syne,sans-serif", letterSpacing: "-0.02em" }}>
            Slow down — too many requests
          </h1>

          <p style={{ fontSize: 15, color: "#6b6b6b", lineHeight: 1.65, maxWidth: 420, margin: "0 auto 32px" }}>
            You've hit the request limit. This is usually caused by repeated rapid refreshes or high activity.
            Give it a moment and try again — your data is safe.
          </p>

          {/* Countdown / retry */}
          {!canRetry ? (
            <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: "20px 32px", marginBottom: 40 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase" }}>Retry available in</span>
              <span style={{ fontSize: 48, fontWeight: 900, color: "#0a0a0a", fontFamily: "Syne,sans-serif", letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
                {secondsLeft}s
              </span>
              {/* Progress bar */}
              <div style={{ width: 180, height: 4, background: "#f0f0f0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "#f59e0b",
                  borderRadius: 99,
                  width: `${((retryAfter - secondsLeft) / retryAfter) * 100}%`,
                  transition: "width 1s linear"
                }} />
              </div>
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 20px", marginBottom: 40 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>Ready — you can try again now</span>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 48 }}>
            <button
              onClick={handleRetry}
              disabled={!canRetry}
              style={{
                ...btnPrimaryStyle,
                opacity: canRetry ? 1 : 0.4,
                cursor: canRetry ? "pointer" : "not-allowed",
                background: canRetry ? "#0a0a0a" : "#888",
              }}
            >
              {canRetry ? "Try again" : `Wait ${secondsLeft}s…`}
            </button>
            <Link to="/" style={btnSecondaryStyle}>Back to home</Link>
            <Link to="/status" style={btnSecondaryStyle}>Check status</Link>
          </div>

          {/* Support */}
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 40 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
              Still seeing this?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <SupportCard title="Status page"   desc="Check for service issues"  href="/status" />
              <SupportCard title="Email support" desc="planit.userhelp@gmail.com" href="mailto:planit.userhelp@gmail.com" />
              <SupportCard title="Help center"   desc="Guides & documentation"    href="/help" />
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #e5e5e5", fontSize: 12, color: "#bbb" }}>
        © {new Date().getFullYear()} PlanIt ·{" "}
        <Link to="/help"    style={{ color: "#aaa", textDecoration: "none" }}>Help</Link> ·{" "}
        <Link to="/privacy" style={{ color: "#aaa", textDecoration: "none" }}>Privacy</Link> ·{" "}
        <Link to="/status"  style={{ color: "#aaa", textDecoration: "none" }}>Status</Link>
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

function SupportCard({ title, desc, href }) {
  return (
    <a href={href}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "16px 18px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 14, textDecoration: "none", transition: "border-color 0.15s, box-shadow 0.15s", textAlign: "left" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#0a0a0a"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e5e5"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>{title}</span>
      <span style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{desc}</span>
    </a>
  );
}

const navLinkStyle      = { fontSize: 13, fontWeight: 600, color: "#444", textDecoration: "none", padding: "7px 14px", borderRadius: 10, border: "1px solid #e5e5e5", background: "transparent" };
const btnPrimaryStyle   = { display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", background: "#0a0a0a", color: "#fff", borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", border: "none", fontFamily: "inherit" };
const btnSecondaryStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 24px", background: "#fff", color: "#0a0a0a", borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1px solid #e5e5e5", cursor: "pointer", fontFamily: "inherit" };