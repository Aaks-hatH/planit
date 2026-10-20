/**
 * frontend/src/components/liquid/LiquidKit.jsx
 *
 * Shared motion + graphics kit for the PlanIt Home and Careers pages.
 *
 *   SmoothScroll     Lenis eased scrolling (skipped for reduced motion; nested scrollers keep native scroll)
 *   PerfGovernor     watches real frame times and sets <html data-perf="high|medium|low">
 *   VineScroll       the scrollbar: a streamer that grows as you scroll, sparks pop along it,
 *                    the thumb is a ticket stub, and a firework bursts when you reach the end
 *   Aurora           drifting colour orbs + twinkling starfield + shooting stars + film grain
 *   Horizon          a glowing planet limb for hero floors ("PlanIt" -> planet)
 *   BlurText         word-by-word blur-in headline
 *   SpotlightStage   cinematic skyline with a subtle pointer glow
 *
 * Every piece respects prefers-reduced-motion and the performance tier.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Lenis from 'lenis';
import '../../styles/liquid.css';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ═══════════════════════════════════════════════════════════════════════════
   Smooth scroll
   ═══════════════════════════════════════════════════════════════════════════ */

// Lenis asks this once per node in the event path. Anything that scrolls on its own
// (modals, drawers, textareas, dropdowns) keeps native scrolling; page-sized wrappers don't count.
function isNestedScroller(node) {
  if (!node || node === document.documentElement || node === document.body || node.nodeType !== 1) return false;
  const cs = getComputedStyle(node);
  if (!/(auto|scroll)/.test(cs.overflowY) || node.scrollHeight <= node.clientHeight + 1) return false;
  return cs.position === 'fixed' || node.getBoundingClientRect().height < window.innerHeight - 2;
}

export function SmoothScroll({ enabled = true }) {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (reducedMotion()) return undefined;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09, smoothWheel: true, prevent: isNestedScroller });
    lenisRef.current = lenis;
    window.lenis = lenis;

    // In-page #links glide instead of jumping. Handlers that already called preventDefault win.
    const onClick = (e) => {
      if (e.defaultPrevented) return;
      const a = e.target.closest?.('a[href^="#"]');
      const id = a?.getAttribute('href');
      if (!id || id.length < 2) return;
      let el = null;
      try { el = document.querySelector(id); } catch { /* invalid selector */ }
      if (!el || el.offsetParent === null) return;
      e.preventDefault();
      lenis.scrollTo(el, { duration: 1.4 });
    };
    document.addEventListener('click', onClick);

    return () => {
      document.removeEventListener('click', onClick);
      lenis.destroy();
      if (window.lenis === lenis) delete window.lenis;
      lenisRef.current = null;
    };
  }, []);

  // Held while a loader / curtain owns the scroll position.
  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    if (enabled) l.start(); else l.stop();
  }, [enabled]);

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Performance governor
   high   everything on
   medium starfields freeze, heavy glass blur is lightened
   low    glass blur off, drifting orbs and zoom off
   Only ever removes decoration. Steps down after ~1.5s of sustained lag and back up after a long smooth stretch,
   waiting longer before each retry so it can't flicker.
   ═══════════════════════════════════════════════════════════════════════════ */
export function PerfGovernor() {
  useEffect(() => {
    const root = document.documentElement;
    const TIERS = ['high', 'medium', 'low'];
    const nav = navigator;
    let tier = 0;
    if ((nav.connection && nav.connection.saveData) || (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)) tier = 1;

    const set = (t) => {
      tier = Math.max(0, Math.min(2, t));
      root.setAttribute('data-perf', TIERS[tier]);
      window.dispatchEvent(new CustomEvent('perfchange', { detail: TIERS[tier] }));
    };
    set(tier);

    let raf = 0;
    let last = performance.now();
    let samples = [];
    let badSince = 0; let goodSince = 0;
    let settleUntil = last + 3000; // ignore page-load jank
    let upgradeWait = 8000;
    const reset = (now, settle) => { samples = []; badSince = 0; goodSince = 0; settleUntil = now + settle; };

    const tick = (now) => {
      const dt = now - last; last = now;
      if (document.visibilityState === 'visible' && dt < 500) {
        samples.push(dt);
        if (samples.length > 60) samples.shift();
      }
      if (now > settleUntil && samples.length >= 30) {
        const fps = 1000 / (samples.reduce((a, b) => a + b, 0) / samples.length);
        if (fps < 45) {
          goodSince = 0;
          if (!badSince) badSince = now;
          if (now - badSince > 1500 && tier < 2) { set(tier + 1); upgradeWait *= 2; reset(now, 2500); }
        } else if (fps > 56) {
          badSince = 0;
          if (!goodSince) goodSince = now;
          if (now - goodSince > upgradeWait && tier > 0) { set(tier - 1); reset(now, 2500); }
        } else { badSince = 0; goodSince = 0; }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => { last = performance.now(); reset(last, 1500); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      root.removeAttribute('data-perf');
    };
  }, []);
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Aurora backdrop
   ═══════════════════════════════════════════════════════════════════════════ */
const PALETTES = {
  indigo: ['#6366f1', '#8b5cf6', '#ec4899'],
  sunset: ['#f472b6', '#fb923c', '#6366f1'],
  violet: ['#8b5cf6', '#6366f1', '#22d3ee'],
  mint:   ['#10b981', '#6366f1', '#22d3ee'],
  amber:  ['#f97316', '#f59e0b', '#ec4899'],
};
const STAR_TINTS = ['255,255,255', '255,255,255', '199,210,254', '251,207,232', '253,230,200'];

export function Aurora({ palette = 'indigo', stars = true, density = 0.00016, orbs = true, className = '' }) {
  const canvasRef = useRef(null);
  const [a, b, c] = PALETTES[palette] || PALETTES.indigo;

  useEffect(() => {
    if (!stars) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduce = reducedMotion();
    let list = []; let shooters = [];
    let raf = 0; let w = 0; let h = 0; let visible = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(w * h * density);
      list = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.1 + 0.2, a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2, v: Math.random() * 0.05 + 0.008,
        tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
        cross: Math.random() < 0.06,
      }));
    };

    const tier = () => document.documentElement.getAttribute('data-perf');
    const canAnimate = () => !reduce && visible && tier() === 'high';

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of list) {
        const alpha = reduce ? s.a : s.a * (0.65 + 0.35 * Math.sin(t / 900 + s.tw));
        ctx.fillStyle = `rgba(${s.tint},${alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.cross && s.r > 0.7) { // a few stars get a four-point glint
          ctx.strokeStyle = `rgba(${s.tint},${alpha * 0.5})`; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(s.x - s.r * 4, s.y); ctx.lineTo(s.x + s.r * 4, s.y); ctx.moveTo(s.x, s.y - s.r * 4); ctx.lineTo(s.x, s.y + s.r * 4); ctx.stroke();
        }
        if (canAnimate()) { s.y += s.v; if (s.y > h) { s.y = 0; s.x = Math.random() * w; } }
      }
      if (canAnimate()) {
        if (shooters.length < 2 && Math.random() < 0.003) {
          shooters.push({ x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, vx: 7 + Math.random() * 4, vy: 3 + Math.random() * 2, life: 0 });
        }
        shooters = shooters.filter((s) => s.life < 46);
        for (const s of shooters) {
          s.x += s.vx; s.y += s.vy; s.life++;
          const f = 1 - s.life / 46;
          const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * f})`); g.addColorStop(1, 'rgba(129,140,248,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); ctx.stroke();
        }
        raf = requestAnimationFrame(draw);
      }
    };

    const restart = () => { cancelAnimationFrame(raf); if (canAnimate()) raf = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; restart(); });
    io.observe(canvas);
    window.addEventListener('perfchange', restart);
    const onResize = () => { resize(); restart(); if (!canAnimate()) draw(performance.now()); };
    window.addEventListener('resize', onResize);
    resize(); draw(0);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('perfchange', restart);
      window.removeEventListener('resize', onResize);
    };
  }, [stars, density]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {orbs && (
        <>
          <div className="lq-orb lq-drift-a" style={{ left: '-12%', top: '-18%', width: '58vw', height: '58vw', background: `radial-gradient(circle, ${a} 0%, transparent 68%)`, opacity: 0.32 }} />
          <div className="lq-orb lq-drift-b" style={{ right: '-14%', top: '8%', width: '52vw', height: '52vw', background: `radial-gradient(circle, ${b} 0%, transparent 68%)`, opacity: 0.28 }} />
          <div className="lq-orb lq-drift-c" style={{ left: '22%', bottom: '-26%', width: '56vw', height: '44vw', background: `radial-gradient(circle, ${c} 0%, transparent 68%)`, opacity: 0.22 }} />
        </>
      )}
      {stars && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
      <div className="lq-grain" />
    </div>
  );
}

/** A glowing planet limb rising from the bottom of a hero. */
export function Horizon({ className = '', height = '46%' }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`} style={{ height }}>
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: '170%', aspectRatio: '1', top: '38%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(129,140,248,.26) 0%, rgba(99,102,241,.07) 28%, transparent 60%), #05050f',
          boxShadow: '0 -1px 0 0 rgba(199,210,254,.45), 0 -26px 90px 6px rgba(99,102,241,.32), 0 -80px 200px rgba(244,114,182,.12)',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Blur-in headline
   ═══════════════════════════════════════════════════════════════════════════ */
export function BlurText({ text, as = 'p', className = '', delay = 90, accent = [], accentClass = 'lq-grad', justify = 'center', start = true, style }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const Tag = motion[as] || motion.p;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const tokens = text.split(/( |\n)/).filter((t) => t && t !== ' ');
  let wi = 0;
  const go = inView && start;
  return (
    <Tag
      ref={ref}
      className={className}
      aria-label={text.replace(/\n/g, ' ')}
      style={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify === 'center' ? 'center' : 'flex-start', columnGap: '0.28em', rowGap: '0.06em', ...style }}
    >
      {tokens.map((tok, k) => {
        if (tok === '\n') return <span key={`br${k}`} aria-hidden="true" style={{ flexBasis: '100%', height: 0 }} />;
        const i = wi++;
        if (reduce) return <span key={k} aria-hidden="true" className={accent.includes(i) ? accentClass : undefined} style={{ display: 'inline-block' }}>{tok}</span>;
        return (
          <motion.span
            key={k}
            aria-hidden="true"
            className={accent.includes(i) ? accentClass : undefined}
            style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}
            initial={{ filter: 'blur(10px)', opacity: 0, y: 50 }}
            animate={go
              ? { filter: ['blur(10px)', 'blur(5px)', 'blur(0px)'], opacity: [0, 0.5, 1], y: [50, -5, 0] }
              : { filter: 'blur(10px)', opacity: 0, y: 50 }}
            transition={{ duration: 0.7, times: [0, 0.5, 1], ease: 'easeOut', delay: (i * delay) / 1000 }}
          >
            {tok}
          </motion.span>
        );
      })}
    </Tag>
  );
}

/** Standard blur-rise preset for cards and paragraphs (use with <motion.* {...rise(i)}>). */
export const rise = (i = 0) => ({
  initial: { filter: 'blur(10px)', opacity: 0, y: 20 },
  whileInView: { filter: 'blur(0px)', opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.8, ease: 'easeOut', delay: 0.15 * i },
});

/* ═══════════════════════════════════════════════════════════════════════════
   Spotlight stage: quiet, cinematic skyline with a subtle pointer glow
   ═══════════════════════════════════════════════════════════════════════════ */
export function SpotlightStage({ children, radius = 260, id, className = '', minHeight = '100dvh' }) {
  const sectionRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || reduce) return undefined;
    const onMove = (event) => {
      const rect = section.getBoundingClientRect();
      section.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      section.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    };
    const onLeave = () => {
      section.style.setProperty('--spot-x', '50%');
      section.style.setProperty('--spot-y', '42%');
    };
    section.addEventListener('pointermove', onMove, { passive: true });
    section.addEventListener('pointerleave', onLeave, { passive: true });
    return () => {
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
    };
  }, [reduce]);

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`relative w-full overflow-hidden bg-[#05050f] ${className}`}
      style={{ minHeight, contain: 'paint', '--spot-x': '50%', '--spot-y': '42%' }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        backgroundImage: 'linear-gradient(180deg, rgba(5,5,15,.2) 0%, rgba(5,5,15,.42) 44%, rgba(5,5,15,.96) 100%), linear-gradient(90deg, rgba(5,5,15,.35) 0%, transparent 48%, rgba(5,5,15,.28) 100%), url("/media/planit-skyline.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center 64%',
        transform: 'scale(1.015)',
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        background: `radial-gradient(circle ${radius}px at var(--spot-x) var(--spot-y), rgba(129,140,248,.15) 0%, rgba(99,102,241,.055) 38%, transparent 75%)`,
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(199,210,254,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(199,210,254,.045) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'linear-gradient(to bottom, black 0%, transparent 82%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, transparent 82%)',
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#05050f]/15 via-transparent to-[#05050f]/85" />
      <div className="relative z-10" style={{ minHeight }}>{children}</div>
    </section>
  );
}
