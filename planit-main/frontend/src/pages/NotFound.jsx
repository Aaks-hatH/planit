import React, { Suspense, useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { 
  Text, 
  Float, 
  MeshDistortMaterial, 
  PerspectiveCamera, 
  Environment,
  ContactShadows,
  OrbitControls,
  MeshWobbleMaterial
} from "@react-three/drei";
import { 
  Bloom, 
  Noise, 
  Vignette, 
  EffectComposer, 
  ChromaticAberration,
  Scanline
} from "@react-three/postprocessing";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { 
  MoveLeft, 
  Terminal, 
  LayoutGrid, 
  Timer, 
  MapPinOff, 
  Ghost, 
  Activity, 
  Lock, 
  ShieldCheck, 
  Zap, 
  Search,
  EyeOff
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * UTILITY: The Industry Standard Class Merger
 * This fixes the clsx issue by explicitly wrapping it and merging Tailwind classes.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- SHADER DEFINITIONS ---

const CustomGlowShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#4f46e5") },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * intensity;
    }
  `
};

// --- 3D ENVIRONMENT COMPONENTS ---

const FloatingGeometricDebris = () => {
  const meshRef = useRef();
  const [items] = useState(() => 
    Array.from({ length: 30 }, () => ({
      position: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      scale: Math.random() * 0.2 + 0.05,
    }))
  );

  useFrame((state) => {
    meshRef.current.rotation.y += 0.001;
    meshRef.current.rotation.x += 0.0005;
  });

  return (
    <group ref={meshRef}>
      {items.map((item, i) => (
        <mesh key={i} position={item.position} rotation={item.rotation} scale={item.scale}>
          <boxGeometry />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
};

const ParticleCloud = ({ count = 1200 }) => {
  const points = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 25;
      p[i * 3 + 1] = (Math.random() - 0.5) * 25;
      p[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return p;
  }, [count]);

  const pointsRef = useRef();
  useFrame(() => {
    pointsRef.current.rotation.y += 0.0008;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={points.length / 3} array={points} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#ffffff" transparent opacity={0.2} sizeAttenuation />
    </points>
  );
};

const EventCore = () => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.distort = THREE.MathUtils.lerp(meshRef.current.distort, hovered ? 0.7 : 0.4, 0.05);
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <sphereGeometry args={[1.5, 128, 128]} />
        <MeshDistortMaterial ref={meshRef} color="#050505" roughness={0.1} metalness={1} distort={0.4} speed={2} />
      </mesh>
    </Float>
  );
};

// --- UI DATA & INTERFACE ---

const DATA_STREAMS = [
  "SCANNING_LOCAL_HOST...",
  "SEARCHING_EVENT_UUID_9921...",
  "AUTH_FAILED_SECTOR_7G",
  "PARSING_VENUE_METADATA...",
  "ERROR_INVALID_COORDINATES",
  "ESTABLISHING_VOID_PROTOCOL...",
  "PACKET_LOSS_DETECTION: 98%",
  "REBOOTING_NEURAL_LINK...",
  "LOCATION_STILL_UNKNOWN"
];

const SidebarMetrics = () => (
  <div className="absolute left-8 top-1/2 -translate-y-1/2 space-y-12 z-30 hidden xl:block">
    {[
      { label: "Sync", icon: Activity, val: "0.02ms" },
      { label: "Enc", icon: Lock, val: "AES-256" },
      { label: "Status", icon: ShieldCheck, val: "SECURED" }
    ].map((item, i) => (
      <motion.div 
        key={i}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 0.4, x: 0 }}
        transition={{ delay: 1.5 + i * 0.2 }}
        className="flex flex-col items-start gap-2 group hover:opacity-100 transition-opacity cursor-crosshair"
      >
        <item.icon size={14} className="text-white" />
        <span className="text-[9px] uppercase tracking-[0.3em] font-black">{item.label}</span>
        <span className="text-[10px] font-mono text-indigo-400">{item.val}</span>
      </motion.div>
    ))}
  </div>
);

const TerminalOutput = () => {
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setHistory(prev => [...prev, DATA_STREAMS[i % DATA_STREAMS.length]]);
      i++;
      if (i > 50) setHistory(prev => prev.slice(1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-64 font-mono text-[8px] opacity-20 hidden lg:block">
      {history.slice(-6).map((line, idx) => (
        <div key={idx} className="mb-1 leading-none">{`> ${line}`}</div>
      ))}
    </div>
  );
};

const LuxuryButton = ({ onClick, children, variant = "ghost" }) => (
  <motion.button
    whileHover={{ scale: 1.02, backgroundColor: variant === "solid" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.1)" }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      "relative px-10 py-4 text-[10px] font-bold uppercase tracking-[0.4em] transition-all duration-500 overflow-hidden group",
      variant === "solid" ? "bg-white text-black" : "border border-white/20 text-white backdrop-blur-md"
    )}
  >
    <span className="relative z-10 flex items-center gap-3">{children}</span>
    {variant === "ghost" && (
      <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
    )}
  </motion.button>
);

// --- MAIN PAGE ARCHITECTURE ---

const NotFound = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative h-screen w-full bg-[#000] text-white overflow-hidden selection:bg-indigo-500">
      
      {/* BACKGROUND GRAPHICS */}
      <div className="absolute inset-0 z-0">
        <Canvas shadows dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.2} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
            <pointLight position={[-10, -10, -10]} color="#4f46e5" intensity={2} />
            
            <EventCore />
            <ParticleCloud />
            <FloatingGeometricDebris />
            
            <Environment preset="city" />
            <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={10} blur={2} />

            <EffectComposer>
              <Bloom luminanceThreshold={1.2} intensity={1.5} levels={8} mipmapBlur />
              <Noise opacity={0.08} />
              <Scanline opacity={0.03} />
              <Vignette darkness={0.9} />
              <ChromaticAberration offset={[0.0015, 0.0015]} />
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      {/* THE "AWWWARDS" TYPOGRAPHY LAYER */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence>
          {ready && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="flex flex-col items-center"
            >
              <div className="relative flex items-center gap-8 mb-4">
                <motion.span 
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="text-[22vw] font-black italic tracking-tighter leading-none"
                >
                  4
                </motion.span>
                <motion.div 
                   initial={{ scale: 0, rotate: -180 }}
                   animate={{ scale: 1, rotate: 0 }}
                   transition={{ delay: 0.3, type: "spring" }}
                   className="w-[12vw] h-[12vw] border-[0.5vw] border-white/10 rounded-full flex items-center justify-center relative"
                >
                  <Search size="4vw" className="text-white/20 animate-pulse" />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-t-[0.5vw] border-white rounded-full" 
                  />
                </motion.div>
                <motion.span 
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="text-[22vw] font-black italic tracking-tighter leading-none"
                >
                  4
                </motion.span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="text-center space-y-4"
              >
                <h2 className="text-[1.2vw] font-bold tracking-[1.5em] uppercase opacity-40 ml-[1.5em]">
                  The Venue Has Moved
                </h2>
                <div className="h-[1px] w-24 bg-white/20 mx-auto" />
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 1.5 }}
                className="mt-16 flex gap-8 pointer-events-auto"
              >
                <LuxuryButton variant="solid" onClick={() => navigate("/")}>
                  <LayoutGrid size={14} /> Back to Planner
                </LuxuryButton>
                <LuxuryButton onClick={() => navigate(-1)}>
                  <MoveLeft size={14} /> Revert Path
                </LuxuryButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PERIPHERAL INTERFACE (HUD) */}
      
      {/* Top Header */}
      <header className="absolute top-0 w-full p-10 flex justify-between items-start z-30">
        <div className="flex gap-6 items-start">
          <div className="p-3 border border-white/10 backdrop-blur-md">
            <Zap size={18} className="text-indigo-500 fill-indigo-500" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black tracking-widest uppercase italic">LuxEvent Protocol</div>
            <div className="text-[8px] font-mono opacity-40">Build: 2026.02.16-FINAL</div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[10px] font-mono text-white/40">NODE_STATUS: <span className="text-red-500">OFFLINE</span></div>
          <div className="text-[10px] font-mono text-white/40 tracking-tighter">REF_DIR: /events/private/null</div>
        </div>
      </header>

      {/* Side Metrics Overlay */}
      <SidebarMetrics />

      {/* Bottom Footer Interface */}
      <footer className="absolute bottom-0 w-full p-10 flex justify-between items-end z-30 border-t border-white/5 bg-gradient-to-t from-black to-transparent">
        <TerminalOutput />
        
        <div className="flex gap-16">
          <div className="text-right space-y-1">
            <div className="text-[9px] uppercase font-bold tracking-[0.3em] opacity-30">Void Coords</div>
            <div className="text-xs font-mono tracking-tighter">40.7128° N, 74.0060° W</div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-[9px] uppercase font-bold tracking-[0.3em] opacity-30">Active System Time</div>
            <div className="text-xs font-mono tracking-tighter uppercase">{new Date().toLocaleTimeString()}</div>
          </div>
          <div className="p-3 border border-white/10 hidden md:block">
            <EyeOff size={16} className="opacity-20" />
          </div>
        </div>
      </footer>

      {/* SCANLINE OVERLAY EFFECT */}
      <div className="absolute inset-0 pointer-events-none z-50 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-150" />
    </div>
  );
};

export default NotFound;
