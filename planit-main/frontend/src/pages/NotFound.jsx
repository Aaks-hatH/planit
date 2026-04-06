import React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function NotFound() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const isEventNotFound = location.state?.eventNotFound ||
    location.pathname.startsWith("/e/") ||
    location.pathname.startsWith("/event/");

  return (
    <div style={{ minHeight:"100vh", background:"#f8f8f8", display:"flex", flexDirection:"column" }}>
      {/* Navbar */}
      <nav style={{ background:"#fff", borderBottom:"1px solid #e5e5e5", padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 }}>
        <Link to="/" style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:20, color:"#0a0a0a", textDecoration:"none", letterSpacing:"-0.02em" }}>PlanIt</Link>
        <div style={{ display:"flex", gap:8 }}>
          <Link to="/help" style={navLinkStyle}>Help Center</Link>
          <Link to="/" style={{ ...navLinkStyle, background:"#0a0a0a", color:"#fff", border:"1px solid #0a0a0a" }}>Go Home</Link>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
        <div style={{ width:"100%", maxWidth:560, textAlign:"center" }}>

          {/* Error pill */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"#fff", border:"1px solid #e5e5e5", borderRadius:100, padding:"6px 16px", marginBottom:32 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#ef4444", display:"inline-block" }} />
            <span style={{ fontSize:12, fontWeight:700, color:"#6b6b6b", letterSpacing:"0.08em", textTransform:"uppercase" }}>
              {isEventNotFound ? "Event Not Found" : "404 Error"}
            </span>
          </div>

          {/* Big 404 */}
          <div style={{ fontSize:"clamp(80px,20vw,140px)", fontWeight:900, lineHeight:1, color:"#0a0a0a", fontFamily:"Syne,sans-serif", letterSpacing:"-0.04em", marginBottom:16 }}>404</div>

          <h1 style={{ fontSize:"clamp(20px,4vw,28px)", fontWeight:800, color:"#0a0a0a", marginBottom:12, fontFamily:"Syne,sans-serif", letterSpacing:"-0.02em" }}>
            {isEventNotFound ? "We couldn't find that event" : "Page not found"}
          </h1>

          <p style={{ fontSize:15, color:"#6b6b6b", lineHeight:1.65, maxWidth:420, margin:"0 auto 40px" }}>
            {isEventNotFound
              ? "The event link may have expired, the URL might be wrong, or the event was deleted. Check the link and try again, or contact the organizer."
              : "This page doesn't exist. It may have been moved or the URL is incorrect."}
          </p>

          {/* Buttons */}
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap", marginBottom:48 }}>
            <button onClick={() => navigate(-1)} style={btnSecondaryStyle}>← Go back</button>
            <Link to="/" style={btnPrimaryStyle}>Back to home</Link>
            {isEventNotFound && <Link to="/discover" style={btnSecondaryStyle}>Browse events</Link>}
          </div>

          {/* Support */}
          <div style={{ borderTop:"1px solid #e5e5e5", paddingTop:40 }}>
            <p style={{ fontSize:12, fontWeight:700, color:"#aaa", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:20 }}>Still need help?</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12 }}>
              <SupportCard icon="✉️" title="Email support" desc="planit.userhelp@gmail.com" href="mailto:planit.userhelp@gmail.com" />
              <SupportCard icon="📖" title="Help center" desc="Guides & documentation" href="/help" />
              <SupportCard icon="🏠" title="Home page" desc="Create or join an event" href="/" />
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer style={{ textAlign:"center", padding:"24px", borderTop:"1px solid #e5e5e5", fontSize:12, color:"#bbb" }}>
        © {new Date().getFullYear()} PlanIt ·{" "}
        <Link to="/help" style={{ color:"#aaa", textDecoration:"none" }}>Help</Link> ·{" "}
        <Link to="/privacy" style={{ color:"#aaa", textDecoration:"none" }}>Privacy</Link>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>
    </div>
  );
}

function SupportCard({ icon, title, desc, href }) {
  return (
    <a href={href}
      style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:6, padding:"16px 18px", background:"#fff", border:"1px solid #e5e5e5", borderRadius:14, textDecoration:"none", transition:"border-color 0.15s, box-shadow 0.15s", textAlign:"left" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#0a0a0a"; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="#e5e5e5"; e.currentTarget.style.boxShadow="none"; }}
    >
      <span style={{ fontSize:22 }}>{icon}</span>
      <span style={{ fontSize:13, fontWeight:700, color:"#0a0a0a" }}>{title}</span>
      <span style={{ fontSize:12, color:"#888", lineHeight:1.4 }}>{desc}</span>
    </a>
  );
}

const navLinkStyle = { fontSize:13, fontWeight:600, color:"#444", textDecoration:"none", padding:"7px 14px", borderRadius:10, border:"1px solid #e5e5e5", background:"transparent" };
const btnPrimaryStyle = { display:"inline-flex", alignItems:"center", gap:6, padding:"12px 24px", background:"#0a0a0a", color:"#fff", borderRadius:12, fontSize:14, fontWeight:700, textDecoration:"none", border:"none", cursor:"pointer" };
const btnSecondaryStyle = { display:"inline-flex", alignItems:"center", gap:6, padding:"12px 24px", background:"#fff", color:"#0a0a0a", borderRadius:12, fontSize:14, fontWeight:600, textDecoration:"none", border:"1px solid #e5e5e5", cursor:"pointer", fontFamily:"inherit" };