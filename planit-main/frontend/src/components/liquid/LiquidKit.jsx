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
 *   SpotlightStage   two-layer party scene: dim by default, lit where the cursor is
 *
 * Every piece respects prefers-reduced-motion and the performance tier.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
   Streamer scrollbar
   ═══════════════════════════════════════════════════════════════════════════ */
const SPARK_COLORS = ['#818cf8', '#f472b6', '#fb923c', '#6ee7b7'];
const BURST_COLORS = ['#f472b6', '#fb923c', '#818cf8', '#fff4e8'];

export function VineScroll() {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: fine)').matches) return undefined; // phones keep their native overlay scrollbar
    const NS = 'http://www.w3.org/2000/svg';
    const docEl = document.documentElement;
    docEl.classList.add('lq-vine-on');

    const wrap = document.createElement('div');
    wrap.id = 'lq-vine';
    wrap.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg');
    wrap.appendChild(svg);
    document.body.appendChild(wrap);

    const W = 24; const X = 12; const AMP = 3.2; const WAVE = 140; const PAD = 18;
    let H = 0; let len = 0; let sparks = []; let grown; let thumb; let burst;
    let progress = 0; let lastY = window.scrollY; let vel = 0; let sway = 0; let raf = 0; let idleT = 0; let dragging = false;

    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
      (parent || svg).appendChild(n);
      return n;
    };
    const xAt = (y) => X + AMP * Math.sin((y / WAVE) * Math.PI * 2);
    const slopeDeg = (y) => Math.atan(AMP * ((2 * Math.PI) / WAVE) * Math.cos((y / WAVE) * Math.PI * 2)) * 180 / Math.PI;
    const maxScroll = () => Math.max(1, docEl.scrollHeight - window.innerHeight);
    const yFor = (p) => PAD + p * (H - 2 * PAD);

    function build() {
      H = window.innerHeight;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

      const defs = el('defs', {});
      const grad = el('linearGradient', { id: 'lq-vine-grad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: H }, defs);
      el('stop', { offset: '0%', 'stop-color': '#818cf8' }, grad);
      el('stop', { offset: '55%', 'stop-color': '#f472b6' }, grad);
      el('stop', { offset: '100%', 'stop-color': '#fb923c' }, grad);

      el('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });

      let d = `M ${xAt(PAD).toFixed(2)} ${PAD}`;
      for (let y = PAD + 4; y <= H - PAD; y += 4) d += ` L ${xAt(y).toFixed(2)} ${y}`;
      el('path', { d, class: 'lq-vine-base' });
      grown = el('path', { d, class: 'lq-vine-grown' });
      len = grown.getTotalLength();
      grown.style.strokeDasharray = len;

      // Sparks: little four-point stars on short stems, alternating sides
      sparks = [];
      let side = 1; let i = 0;
      for (let sy = PAD + 46; sy < H - PAD - 30; sy += 58) {
        const c = SPARK_COLORS[i % SPARK_COLORS.length];
        const g = el('g', { transform: `translate(${xAt(sy).toFixed(2)} ${sy})` });
        const inner = el('g', { class: 'lq-spark' }, g);
        el('path', { d: `M0 0 Q ${3 * side} -1.5 ${7 * side} -5`, fill: 'none', stroke: c, 'stroke-width': 1, 'stroke-linecap': 'round', opacity: 0.8 }, inner);
        const s = i % 2 ? 0.8 : 1.05;
        el('path', {
          d: 'M0 -5 C.9 -1.6 1.6 -.9 5 0 C1.6 .9 .9 1.6 0 5 C-.9 1.6 -1.6 .9 -5 0 C-1.6 -.9 -.9 -1.6 0 -5 Z',
          fill: c,
          transform: `translate(${7 * side} -5.5) scale(${s}) rotate(${side * 12})`,
        }, inner);
        sparks.push({ y: sy, node: inner });
        side *= -1; i++;
      }

      // Finale: a firework at the end of the track
      burst = el('g', { class: 'lq-burst', transform: `translate(${xAt(H - PAD).toFixed(2)} ${H - PAD})` });
      const bi = el('g', { class: 'lq-burst-inner' }, burst);
      el('circle', { cx: 0, cy: 0, r: 4, fill: 'none', stroke: '#f472b6', 'stroke-width': 1, class: 'lq-burst-pulse' }, bi);
      for (let r = 0; r < 10; r++) {
        const long = r % 2 === 0;
        el('line', { x1: 0, y1: -3.2, x2: 0, y2: long ? -9.5 : -6.4, stroke: BURST_COLORS[r % 4], 'stroke-width': long ? 1.5 : 1.1, class: 'lq-burst-ray', transform: `rotate(${r * 36})` }, bi);
      }
      el('circle', { cx: 0, cy: 0, r: 2, class: 'lq-burst-core' }, bi);

      // Thumb: a ticket stub with notched sides and a perforation
      thumb = el('g', { class: 'lq-thumb' });
      const ti = el('g', { class: 'lq-thumb-inner' }, thumb);
      el('path', { d: 'M-10 -5 H10 V-1.6 A1.6 1.6 0 0 0 10 1.6 V5 H-10 V1.6 A1.6 1.6 0 0 0 -10 -1.6 Z', class: 'lq-thumb-body' }, ti);
      el('path', { d: 'M-10 -5 H10 V-1.6 A1.6 1.6 0 0 0 10 1.6 V5 H-10 V1.6 A1.6 1.6 0 0 0 -10 -1.6 Z', class: 'lq-thumb-edge' }, ti);
      el('path', { d: 'M-3.4 -3.8 V3.8', class: 'lq-thumb-dash' }, ti);
      el('path', { d: 'M3.6 -2.4 L4.6 0 L3.6 2.4 L6.4 0 Z', fill: '#f472b6' }, ti);

      progress = Math.min(1, Math.max(0, window.scrollY / maxScroll()));
      render();
    }

    function render() {
      const y = yFor(progress);
      grown.style.strokeDashoffset = (len * (1 - progress)).toFixed(1);
      for (let i = 0; i < sparks.length; i++) sparks[i].node.classList.toggle('on', sparks[i].y <= y + 2);
      burst.classList.toggle('on', progress > 0.985);
      const rot = 90 - slopeDeg(y) + sway;
      thumb.setAttribute('transform', `translate(${xAt(y).toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`);
    }

    function loop() {
      const sy = window.scrollY;
      vel = sy - lastY; lastY = sy;
      progress = Math.min(1, Math.max(0, sy / maxScroll()));
      const target = Math.max(-28, Math.min(28, vel * 0.5)); // the stub sways with scroll speed
      sway += (target - sway) * 0.12;
      render();
      if (Math.abs(sway) > 0.05 || Math.abs(vel) > 0.1) raf = requestAnimationFrame(loop);
      else raf = 0;
    }

    function wake() {
      wrap.classList.add('active');
      clearTimeout(idleT);
      idleT = setTimeout(() => { if (!dragging) wrap.classList.remove('active'); }, 1400);
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function scrollToProgress(p, immediate) {
      const target = Math.min(1, Math.max(0, p)) * maxScroll();
      if (window.lenis) window.lenis.scrollTo(target, immediate ? { immediate: true } : { duration: 1.2 });
      else window.scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' });
    }
    const pFromEvent = (e) => (e.clientY - PAD) / (H - 2 * PAD);

    const onDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (e.target.closest && e.target.closest('.lq-thumb')) {
        dragging = true;
        docEl.classList.add('lq-vine-dragging');
        wrap.setPointerCapture(e.pointerId);
      } else {
        scrollToProgress(pFromEvent(e), false);
      }
      wake();
    };
    const onMove = (e) => { if (!dragging) return; scrollToProgress(pFromEvent(e), true); wake(); };
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      docEl.classList.remove('lq-vine-dragging');
      try { wrap.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      wake();
    };
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    window.addEventListener('scroll', wake, { passive: true });
    let rT = 0;
    const onResize = () => { clearTimeout(rT); rT = setTimeout(build, 100); };
    window.addEventListener('resize', onResize);
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(loop); }); ro.observe(document.body); }

    build();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleT); clearTimeout(rT);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      wrap.remove();
      docEl.classList.remove('lq-vine-on', 'lq-vine-dragging');
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
      style={{ display: 'flex', flexWrap: 'wrap', justifyContent: justify === 'center' ? 'center' : 'flex-start', rowGap: '0.04em', ...style }}
    >
      {tokens.map((tok, k) => {
        if (tok === '\n') return <span key={`br${k}`} aria-hidden="true" style={{ flexBasis: '100%', height: 0 }} />;
        const i = wi++;
        if (reduce) return <span key={k} aria-hidden="true" className={accent.includes(i) ? accentClass : undefined} style={{ display: 'inline-block', marginRight: '0.26em' }}>{tok}</span>;
        return (
          <motion.span
            key={k}
            aria-hidden="true"
            className={accent.includes(i) ? accentClass : undefined}
            style={{ display: 'inline-block', marginRight: '0.26em', willChange: 'transform, filter, opacity' }}
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
   Spotlight stage: a party scene that is dim until the cursor lights it up
   ═══════════════════════════════════════════════════════════════════════════ */
const PARTY = ['#818cf8', '#f472b6', '#fb923c', '#6ee7b7', '#fde68a', '#a78bfa'];

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One deterministic scene, rendered twice (dim + lit) so the two layers line up exactly.
const SCENE = (() => {
  const rnd = mulberry32(2026);
  const swags = [[-60, 560, 40, 150], [540, 1100, 64, 172], [1080, 1700, 30, 140]].map(([x0, x1, y, sag], si) => {
    const bulbs = Array.from({ length: 9 }, (_, k) => {
      const t = (k + 0.5) / 9;
      return { x: x0 + (x1 - x0) * t, y: y + sag * 4 * t * (1 - t), c: PARTY[(k + si * 2) % PARTY.length], d: ((k * 0.37 + si) % 3).toFixed(2) };
    });
    return { d: `M${x0} ${y} Q${(x0 + x1) / 2} ${y + 2 * sag} ${x1} ${y}`, bulbs };
  });
  const confetti = Array.from({ length: 96 }, () => ({
    x: rnd() * 1600, y: 120 + rnd() * 700, rot: rnd() * 360, s: 6 + rnd() * 14, kind: Math.floor(rnd() * 3), c: PARTY[Math.floor(rnd() * PARTY.length)],
  }));
  const bokeh = Array.from({ length: 16 }, () => ({ x: rnd() * 1600, y: 80 + rnd() * 640, r: 22 + rnd() * 62, c: PARTY[Math.floor(rnd() * PARTY.length)] }));
  const beams = [260, 800, 1340].map((x, i) => ({ x, c: PARTY[(i * 2 + 1) % PARTY.length] }));
  const rays = Array.from({ length: 17 }, (_, i) => 800 + (i - 8) * 260);
  const rows = Array.from({ length: 8 }, (_, j) => 560 + 340 * (((j + 1) / 8) ** 2));
  return { swags, confetti, bokeh, beams, rays, rows };
})();

function PartyScene({ lit }) {
  const k = lit ? 'l' : 'd';
  const col = (c) => (lit ? c : '#6b70d6');
  const op = (v) => (lit ? v : v * 0.2);
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`lq-bg-${k}`} x1="0" y1="0" x2="0" y2="1">
          {lit
            ? (<><stop offset="0" stopColor="#120d3d" /><stop offset=".5" stopColor="#2f1767" /><stop offset="1" stopColor="#80295f" /></>)
            : (<><stop offset="0" stopColor="#05050f" /><stop offset="1" stopColor="#0b0a20" /></>)}
        </linearGradient>
        <radialGradient id={`lq-hz-${k}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fb923c" stopOpacity={lit ? 0.55 : 0.08} /><stop offset="1" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`lq-beam-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={lit ? 0.3 : 0.05} /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`lq-floor-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lit ? '#f472b6' : '#6366f1'} stopOpacity={lit ? 0.28 : 0.06} /><stop offset="1" stopColor="#05050f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#lq-bg-${k})`} />
      <ellipse cx="800" cy="560" rx="900" ry="190" fill={`url(#lq-hz-${k})`} />

      {SCENE.beams.map((b) => (
        <polygon key={b.x} points={`${b.x - 14},0 ${b.x + 14},0 ${b.x + 210},620 ${b.x - 210},620`} fill={`url(#lq-beam-${k})`} />
      ))}

      <rect x="0" y="560" width="1600" height="340" fill={`url(#lq-floor-${k})`} />
      <g stroke={col('#a5b4fc')} strokeWidth="1.2" opacity={op(0.5)}>
        {SCENE.rays.map((x) => <line key={x} x1="800" y1="560" x2={x} y2="980" />)}
        {SCENE.rows.map((y) => <line key={y} x1="0" y1={y} x2="1600" y2={y} />)}
      </g>

      {SCENE.bokeh.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={col(b.c)} opacity={op(0.1)} />)}

      <g className="lq-bob">
        {SCENE.confetti.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`} fill={col(p.c)} opacity={op(0.9)}>
            {p.kind === 0 && <rect x={-p.s / 2} y={-p.s / 4} width={p.s} height={p.s / 2} rx="1.5" />}
            {p.kind === 1 && <circle r={p.s / 3} />}
            {p.kind === 2 && <polygon points={`0,${-p.s / 2} ${p.s / 2},${p.s / 2} ${-p.s / 2},${p.s / 2}`} />}
          </g>
        ))}
      </g>

      {SCENE.swags.map((s, si) => (
        <g key={si}>
          <path d={s.d} fill="none" stroke={col('#c7d2fe')} strokeWidth="1.6" opacity={op(0.55)} />
          {s.bulbs.map((b, i) => (
            <g key={i}>
              {lit && <circle className="lq-twinkle" style={{ animationDelay: `${b.d}s` }} cx={b.x} cy={b.y + 9} r="26" fill={b.c} opacity=".26" />}
              <circle cx={b.x} cy={b.y + 9} r="7" fill={col(b.c)} opacity={op(1)} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

const SPOT_MASK = (r, x, y) => `radial-gradient(circle ${r}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 40%, rgba(255,255,255,.75) 60%, rgba(255,255,255,.4) 75%, rgba(255,255,255,.12) 88%, rgba(255,255,255,0) 100%)`;

export function SpotlightStage({ children, radius = 260, id, className = '', minHeight = '100dvh' }) {
  const sectionRef = useRef(null);
  const revealRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current; const reveal = revealRef.current;
    if (!section || !reveal) return undefined;
    const reduce = reducedMotion();
    const mouse = { x: -999, y: -999 };
    const smooth = { x: -999, y: -999 };
    let lastInput = -1e9; let raf = 0; let lastX = -1e5; let lastY = -1e5;

    const setMask = (x, y) => {
      const m = SPOT_MASK(radius, x, y);
      reveal.style.maskImage = m; reveal.style.webkitMaskImage = m;
    };
    setMask(-999, -999);

    const toLocal = (cx, cy) => { const r = section.getBoundingClientRect(); mouse.x = cx - r.left; mouse.y = cy - r.top; lastInput = performance.now(); };
    const onMove = (e) => toLocal(e.clientX, e.clientY);
    const onTouch = (e) => { const t = e.touches[0]; if (t) toLocal(t.clientX, t.clientY); };

    const loop = () => {
      const r = section.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        const now = performance.now();
        let tx = mouse.x; let ty = mouse.y;
        if (reduce) { tx = r.width * 0.68; ty = r.height * 0.42; }
        else if (now - lastInput > 2600) { // nobody pointing: the light drifts on its own
          const t = now / 1000;
          tx = r.width * (0.5 + 0.32 * Math.sin(t * 0.5)); ty = r.height * (0.46 + 0.2 * Math.sin(t * 0.37 + 1.2));
        }
        if (smooth.x === -999) { smooth.x = tx; smooth.y = ty; }
        smooth.x += (tx - smooth.x) * 0.08; smooth.y += (ty - smooth.y) * 0.08;
        if (Math.abs(smooth.x - lastX) > 0.3 || Math.abs(smooth.y - lastY) > 0.3) { setMask(smooth.x, smooth.y); lastX = smooth.x; lastY = smooth.y; }
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    section.addEventListener('touchstart', onTouch, { passive: true });
    section.addEventListener('touchmove', onTouch, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      section.removeEventListener('touchstart', onTouch);
      section.removeEventListener('touchmove', onTouch);
    };
  }, [radius]);

  const dim = useMemo(() => <PartyScene lit={false} />, []);
  const lit = useMemo(() => <PartyScene lit />, []);

  return (
    <section id={id} ref={sectionRef} className={`relative w-full overflow-hidden bg-[#05050f] ${className}`} style={{ minHeight, contain: 'paint' }}>
      <div className="absolute inset-0 z-10">{dim}</div>
      <div ref={revealRef} className="pointer-events-none absolute inset-0 z-30">{lit}</div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-b from-[#05050f]/55 via-transparent to-[#05050f]/75" />
      <div className="relative z-50" style={{ minHeight }}>{children}</div>
    </section>
  );
}
