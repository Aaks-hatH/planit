import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StarBackground from "../components/StarBackground";

// ─── FLOATING DEBRIS ──────────────────────────────────────────────────────────
const DEBRIS = ["⬡", "◈", "⬟", "◇", "▸", "⬢", "◉", "⬠"];

function Debris({ delay, duration, x, symbol, size, opacity }) {
  return (
    <motion.div
      className="absolute select-none pointer-events-none"
      style={{ left: `${x}%`, top: "-5%", fontSize: size, opacity, color: "#4a7fa5", zIndex: 1 }}
      animate={{ y: ["0vh", "110vh"], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)], x: [`0px`, `${(Math.random() - 0.5) * 120}px`] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
    >
      {symbol}
    </motion.div>
  );
}

// ─── GLITCH TEXT ──────────────────────────────────────────────────────────────
function GlitchText({ children, className }) {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const trigger = () => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 300 + Math.random() * 200);
    };
    const id = setInterval(trigger, 2500 + Math.random() * 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`relative inline-block ${className}`}>
      <span style={{ position: "relative", zIndex: 2 }}>{children}</span>
      {glitch && (
        <>
          <span
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              color: "#00ffff", clipPath: "inset(20% 0 60% 0)",
              transform: `translateX(${(Math.random() - 0.5) * 14}px)`,
              zIndex: 1, mixBlendMode: "screen", opacity: 0.85,
            }}
          >
            {children}
          </span>
          <span
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              color: "#ff003c", clipPath: "inset(60% 0 15% 0)",
              transform: `translateX(${(Math.random() - 0.5) * 10}px)`,
              zIndex: 1, mixBlendMode: "screen", opacity: 0.85,
            }}
          >
            {children}
          </span>
        </>
      )}
    </div>
  );
}

// ─── MISSION TERMINAL ─────────────────────────────────────────────────────────
const TERMINAL_LINES = [
  { text: "> SIGNAL LOST — scanning sector 404...", delay: 0 },
  { text: "> No planets found at this coordinate.", delay: 1200 },
  { text: "> Checking PlanIt navigation logs...", delay: 2600 },
  { text: "> ERROR: Page ejected from orbit 47.3s ago.", delay: 4100 },
  { text: "> Initiating rescue protocol DELTA-9...", delay: 5800 },
  { text: "> Rescue ETA: unknown. Stay calm.", delay: 7200 },
  { text: "> Tip: You can still click the stars. 🌟", delay: 9000 },
];

function Terminal() {
  const [lines, setLines] = useState([]);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    TERMINAL_LINES.forEach(({ text, delay }) => {
      setTimeout(() => setLines(l => [...l, text]), delay);
    });
    const blink = setInterval(() => setCursor(c => !c), 530);
    return () => clearInterval(blink);
  }, []);

  return (
    <div
      style={{
        background: "rgba(0,8,20,0.82)",
        border: "1px solid rgba(0,200,255,0.25)",
        borderRadius: 8,
        padding: "14px 18px",
        fontFamily: "'Space Mono', 'Courier New', monospace",
        fontSize: "0.72rem",
        lineHeight: 1.7,
        color: "#7de8ff",
        maxWidth: 460,
        width: "100%",
        backdropFilter: "blur(12px)",
        boxShadow: "0 0 32px rgba(0,200,255,0.08), inset 0 0 24px rgba(0,0,0,0.4)",
        textAlign: "left",
        minHeight: 200,
      }}
    >
      <div style={{ color: "rgba(0,200,255,0.5)", marginBottom: 8, fontSize: "0.65rem", letterSpacing: 2 }}>
        ◉ MISSION CONTROL — PLANIT OPS
      </div>
      {lines.map((line, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          style={{ color: line.includes("ERROR") ? "#ff6b6b" : line.includes("Tip") ? "#a8f5a0" : "#7de8ff" }}
        >
          {line}
        </motion.div>
      ))}
      {lines.length < TERMINAL_LINES.length && (
        <span style={{ opacity: cursor ? 1 : 0, color: "#00ffff" }}>█</span>
      )}
    </div>
  );
}

// ─── ORBITING PLANET ─────────────────────────────────────────────────────────
function OrbitingPlanet({ radius, speed, color, size, startAngle, emoji }) {
  return (
    <motion.div
      style={{
        position: "absolute", width: size, height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size * 0.8}px ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.55,
        zIndex: 2,
      }}
      animate={{
        x: [`${Math.cos(startAngle) * radius}px`, `${Math.cos(startAngle + Math.PI * 2) * radius}px`],
        y: [`${Math.sin(startAngle) * radius * 0.4}px`, `${Math.sin(startAngle + Math.PI * 2) * radius * 0.4}px`],
      }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
    >
      {emoji}
    </motion.div>
  );
}

// ─── ASTRONAUT ────────────────────────────────────────────────────────────────
function LostAstronaut() {
  return (
    <motion.div
      style={{ position: "relative", display: "inline-block", fontSize: "5rem", zIndex: 5 }}
      animate={{ y: [0, -18, 0], rotate: [-6, 6, -6], x: [0, 8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
    >
      👨‍🚀
      {/* Distress beacon blinking */}
      <motion.div
        style={{
          position: "absolute", top: -4, right: -4, width: 10, height: 10,
          borderRadius: "50%", background: "#ff4444",
          boxShadow: "0 0 8px #ff4444",
        }}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
    </motion.div>
  );
}

// ─── PULSING RING ─────────────────────────────────────────────────────────────
function PulsingRing({ delay = 0 }) {
  return (
    <motion.div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        border: "1px solid rgba(0,200,255,0.3)",
        pointerEvents: "none",
      }}
      animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
      transition={{ duration: 3, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function NotFound() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Debri items (stable across renders)
  const debrisItems = useRef(
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      symbol: DEBRIS[i % DEBRIS.length],
      size: `${10 + Math.random() * 14}px`,
      opacity: 0.15 + Math.random() * 0.3,
      delay: Math.random() * 8,
      duration: 12 + Math.random() * 20,
    }))
  ).current;

  const handleExplode = useCallback(() => {
    if (typeof window.__starExplosion === "function") window.__starExplosion();
    const next = clickCount + 1;
    setClickCount(next);
    if (next >= 3) setShowSecret(true);
  }, [clickCount]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#06060c",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── STAR BACKGROUND ── */}
      <StarBackground fixed forceActive />

      {/* ── FLOATING DEBRIS ── */}
      {debrisItems.map(d => <Debris key={d.id} {...d} />)}

      {/* ── SCAN LINE OVERLAY ── */}
      <div
        style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3,
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        }}
      />

      {/* ── MOVING SCAN BAR ── */}
      <motion.div
        style={{
          position: "fixed", left: 0, right: 0, height: 2, zIndex: 4,
          background: "linear-gradient(90deg, transparent, rgba(0,200,255,0.18), transparent)",
          pointerEvents: "none",
        }}
        animate={{ top: ["0vh", "100vh"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      <AnimatePresence>
        {ready && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{
              position: "relative", zIndex: 10,
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "2rem", padding: "2rem 1.5rem",
              textAlign: "center",
            }}
          >
            {/* ── MISSION BADGE ── */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.25em",
                color: "rgba(0,200,255,0.6)",
                border: "1px solid rgba(0,200,255,0.2)",
                borderRadius: 2,
                padding: "4px 12px",
              }}
            >
              ◉ PLANIT DEEP SPACE NAVIGATION SYSTEM ◉
            </motion.div>

            {/* ── ASTRONAUT + 404 CLUSTER ── */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.9, type: "spring", bounce: 0.3 }}
              style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {/* Pulsing rings behind 404 */}
              <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%" }}>
                <PulsingRing delay={0} />
                <PulsingRing delay={1} />
                <PulsingRing delay={2} />
              </div>

              {/* 404 */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <GlitchText
                  className=""
                >
                  <span
                    style={{
                      fontFamily: "'Space Mono', 'Courier New', monospace",
                      fontSize: "clamp(5rem, 18vw, 10rem)",
                      fontWeight: 900,
                      letterSpacing: "-0.04em",
                      background: "linear-gradient(135deg, #ffffff 0%, #7de8ff 40%, #0099cc 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 30px rgba(0,200,255,0.5))",
                      lineHeight: 1,
                    }}
                  >
                    4
                  </span>
                </GlitchText>

                {/* Astronaut in the O */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "clamp(5rem, 18vw, 10rem)",
                      fontWeight: 900,
                      color: "transparent",
                      WebkitTextStroke: "3px rgba(0,200,255,0.4)",
                      lineHeight: 1,
                      userSelect: "none",
                    }}
                  >
                    0
                  </span>
                  <div style={{ position: "absolute" }}>
                    <LostAstronaut />
                  </div>
                </div>

                <GlitchText>
                  <span
                    style={{
                      fontFamily: "'Space Mono', 'Courier New', monospace",
                      fontSize: "clamp(5rem, 18vw, 10rem)",
                      fontWeight: 900,
                      letterSpacing: "-0.04em",
                      background: "linear-gradient(135deg, #ffffff 0%, #7de8ff 40%, #0099cc 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 30px rgba(0,200,255,0.5))",
                      lineHeight: 1,
                    }}
                  >
                    4
                  </span>
                </GlitchText>
              </div>

              {/* Orbiting planets */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <OrbitingPlanet radius={130} speed={8} color="#cc5533" size={18} startAngle={0} emoji="🪐" />
                <OrbitingPlanet radius={170} speed={13} color="#3355cc" size={12} startAngle={2.1} emoji="🌑" />
                <OrbitingPlanet radius={105} speed={5.5} color="#33aa66" size={10} startAngle={4.2} emoji="⭐" />
              </div>
            </motion.div>

            {/* ── HEADLINE ── */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.7 }}
            >
              <h2
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "clamp(1rem, 3vw, 1.5rem)",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: "0.4rem",
                  letterSpacing: "0.08em",
                }}
              >
                THIS PLANET DOESN'T EXIST
              </h2>
              <p
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.75rem",
                  color: "rgba(125,232,255,0.6)",
                  letterSpacing: "0.12em",
                }}
              >
                The page you charted has drifted out of orbit — or was never discovered.
              </p>
            </motion.div>

            {/* ── TERMINAL ── */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.7 }}
            >
              <Terminal />
            </motion.div>

            {/* ── SECRET MESSAGE ── */}
            <AnimatePresence>
              {showSecret && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.7rem",
                    color: "#a8f5a0",
                    border: "1px solid rgba(168,245,160,0.3)",
                    borderRadius: 4,
                    padding: "8px 16px",
                    background: "rgba(0,20,0,0.6)",
                  }}
                >
                  🌟 SUPERNOVA ACTIVATED — you found the easter egg! You're a true PlanIt explorer.
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── NAV BUTTONS ── */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.7 }}
              style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}
            >
              {[
                {
                  label: "🚀 Warp Home",
                  onClick: () => navigate("/"),
                  glow: "#0099cc",
                  bg: "rgba(0,153,204,0.15)",
                  border: "rgba(0,153,204,0.5)",
                },
                {
                  label: "↩ Last Known Coords",
                  onClick: () => navigate(-1),
                  glow: "#7055cc",
                  bg: "rgba(112,85,204,0.12)",
                  border: "rgba(112,85,204,0.4)",
                },
                {
                  label: "💫 Trigger Supernova",
                  onClick: handleExplode,
                  glow: "#cc8800",
                  bg: "rgba(204,136,0,0.12)",
                  border: "rgba(204,136,0,0.4)",
                },
                {
                  label: "🛸 Mission Control",
                  onClick: () => navigate("/help"),
                  glow: "#33cc66",
                  bg: "rgba(51,204,102,0.10)",
                  border: "rgba(51,204,102,0.35)",
                },
              ].map(({ label, onClick, glow, bg, border }) => (
                <motion.button
                  key={label}
                  onClick={onClick}
                  whileHover={{ scale: 1.06, boxShadow: `0 0 24px ${glow}66` }}
                  whileTap={{ scale: 0.94 }}
                  style={{
                    padding: "0.65rem 1.2rem",
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 6,
                    color: "#ffffff",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.72rem",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {label}
                </motion.button>
              ))}
            </motion.div>

            {/* ── BOTTOM HINT ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 1 }}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.58rem",
                color: "rgba(125,232,255,0.28)",
                letterSpacing: "0.18em",
              }}
            >
              HINT: CLICK "TRIGGER SUPERNOVA" THREE TIMES
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GOOGLE FONTS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
      `}</style>
    </div>
  );
}