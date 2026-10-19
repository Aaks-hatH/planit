/**
 * frontend/src/components/liquid/ScrollStory.jsx
 *
 * Apple-style scroll pieces that run on real pictures (set them in src/content/media.js).
 *
 *   MediaSlot   a picture frame with blueprint corner marks. Empty src shows a labelled placeholder.
 *   ZoomReveal  a card that grows to full screen as you scroll, caption fades in on top.
 *   ScrollStory a pinned stage: pictures cross-fade and push in while the copy swaps beside them.
 *   Marquee     slow horizontal strip of pictures that drifts sideways with scroll.
 *
 * Mobile notes:
 *   - Pinned stages use 100dvh (with a 100vh fallback) so the bottom is never hidden behind the browser bar.
 *   - ZoomReveal animates clip-path instead of width/height, so it does not re-layout every frame.
 *   - Story copy is stacked in one grid cell, so the box is as tall as the longest text and nothing overlaps.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionTemplate, useReducedMotion } from 'framer-motion';

const cx = (...a) => a.filter(Boolean).join(' ');

function Corner({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" className={cx('absolute h-3.5 w-3.5 text-white/45', className)}>
      <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

/* ───────────── picture frame ───────────── */
export function MediaSlot({ src, alt = '', label = 'IMAGE', className = '', imgClassName = '', style, imgStyle, children, frame = true }) {
  return (
    <div className={cx('relative overflow-hidden bg-[#0b0c22]', className)} style={style}>
      {src ? (
        <motion.img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className={cx('absolute inset-0 h-full w-full object-cover', imgClassName)} style={imgStyle} />
      ) : (
        <motion.div className="absolute inset-0" style={imgStyle} role="img" aria-label={alt || label}>
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 30% 20%, rgba(99,102,241,0.35), transparent 60%), radial-gradient(90% 80% at 85% 90%, rgba(236,72,153,0.28), transparent 60%), #0b0c22' }} />
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/55">Add your photo</span>
            <span className="max-w-[80%] font-mono text-[11px] tracking-[0.12em] text-white/35">{label}</span>
          </div>
        </motion.div>
      )}
      {frame && (
        <>
          <Corner className="left-3 top-3" /><Corner className="right-3 top-3" />
          <Corner className="bottom-3 left-3" /><Corner className="bottom-3 right-3" />
        </>
      )}
      {children}
    </div>
  );
}

/* ───────────── card → full screen ───────────── */
export function ZoomReveal({ media, label = 'media.js → hero', kicker, title, text, id }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  // The picture fills the screen and a clip-path "window" opens up (cheap on phones, no layout work).
  const inX = useTransform(p, [0, 0.5], [9, 0]);
  const inY = useTransform(p, [0, 0.5], [20, 0]);
  const rad = useTransform(p, [0, 0.5], [32, 0]);
  const clip = useMotionTemplate`inset(${inY}% ${inX}% round ${rad}px)`;
  const s = useTransform(p, [0, 0.8], [1.2, 1]);
  const shade = useTransform(p, [0.35, 0.85], [0.1, 0.6]);
  const ty = useTransform(p, [0.5, 0.85], [60, 0]);
  const to = useTransform(p, [0.5, 0.85], [0, 1]);

  if (reduce) {
    return (
      <section id={id} className="relative px-5 py-16 sm:px-6 sm:py-20">
        <MediaSlot src={media?.src} alt={media?.alt} label={label} className="mx-auto aspect-[16/10] max-w-5xl rounded-2xl sm:rounded-3xl" />
        <div className="mx-auto mt-8 max-w-2xl text-center"><h2 className="lq-display text-3xl sm:text-4xl">{title}</h2><p className="mt-3 text-white/60">{text}</p></div>
      </section>
    );
  }
  return (
    <section id={id} ref={ref} className="relative" style={{ height: '260vh' }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ height: '100dvh' }}>
        <motion.div className="absolute inset-0" style={{ clipPath: clip, WebkitClipPath: clip, willChange: 'clip-path' }}>
          <MediaSlot src={media?.src} alt={media?.alt} label={label} className="h-full w-full" imgStyle={{ scale: s }} frame={false}>
            <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
          </MediaSlot>
        </motion.div>
        <motion.div
          className="absolute inset-x-0 bottom-0 px-6 pt-10 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-14 sm:pb-14"
          style={{ y: ty, opacity: to }}
        >
          {kicker && <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/70 sm:mb-4 sm:text-[11px]">{kicker}</p>}
          <h2 className="lq-display max-w-4xl break-words text-[1.9rem] leading-[1.05] text-white sm:text-6xl lg:text-7xl">{title}</h2>
          {text && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80 sm:mt-5 sm:text-lg">{text}</p>}
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────── pinned cross-fade story ───────────── */
function Frame({ i, n, p, item, label }) {
  const a = i / n; const b = (i + 1) / n; const f = 0.05;
  const first = i === 0; const last = i === n - 1;
  const op = useTransform(p, first ? [0, b - f, b + f] : last ? [a - f, a + f, 1] : [a - f, a + f, b - f, b + f],
    first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0]);
  const sc = useTransform(p, [a - 0.1, b + 0.1], [1.16, 1.0]);
  const ty = useTransform(p, [a - 0.1, b + 0.1], ['4%', '-4%']);
  return (
    <motion.div className="absolute inset-0" style={{ opacity: op }}>
      <MediaSlot src={item.src} alt={item.alt} label={`${label}[${i}]`} className="h-full w-full" imgStyle={{ scale: sc, y: ty }} />
    </motion.div>
  );
}
function Copy({ i, n, p, item }) {
  const a = i / n; const b = (i + 1) / n; const f = 0.05;
  const first = i === 0; const last = i === n - 1;
  const op = useTransform(p, first ? [0, b - f, b] : last ? [a, a + f, 1] : [a, a + f, b - f, b],
    first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0]);
  const y = useTransform(p, first ? [0, b - f, b] : last ? [a, a + f, 1] : [a, a + f, b - f, b],
    first ? [0, 0, -40] : last ? [40, 0, 0] : [40, 0, 0, -40]);
  return (
    <motion.div className="col-start-1 row-start-1" style={{ opacity: op, y }}>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-indigo-300/80 sm:mb-4 sm:text-[11px]">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</p>
      <h3 className="lq-display break-words text-[1.75rem] leading-[1.08] text-white sm:text-5xl lg:text-6xl">{item.title}</h3>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70 sm:mt-5 sm:text-lg">{item.text}</p>
    </motion.div>
  );
}

export function ScrollStory({ items, label = 'media.js → story', kicker, id, heightPerFrame = 90 }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const n = items.length;
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const bar = useTransform(p, [0, 1], ['0%', '100%']);

  if (reduce) {
    return (
      <section id={id} className="relative mx-auto max-w-6xl space-y-12 px-5 py-16 sm:space-y-16 sm:px-6 sm:py-24">
        {items.map((it, i) => (
          <div key={i} className="grid items-center gap-8 md:grid-cols-2">
            <MediaSlot src={it.src} alt={it.alt} label={`${label}[${i}]`} className="aspect-[16/10] rounded-2xl" />
            <div><h3 className="lq-display text-2xl sm:text-3xl">{it.title}</h3><p className="mt-3 text-white/65">{it.text}</p></div>
          </div>
        ))}
      </section>
    );
  }
  return (
    <section id={id} ref={ref} className="relative" style={{ height: `${n * heightPerFrame + 40}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-5 pb-20 pt-4 sm:px-10 sm:pb-4 lg:px-16" style={{ height: '100dvh' }}>
        {kicker && <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 sm:mb-6 sm:text-[11px]">{kicker}</p>}
        <div className="mx-auto grid w-full max-w-7xl items-center gap-5 sm:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-16">
          {/* copy: every item sits in the same grid cell, so the box is as tall as the longest text and nothing overlaps */}
          <div className="relative order-2 grid min-w-0 lg:order-1">
            {items.map((it, i) => <Copy key={i} i={i} n={n} p={p} item={it} />)}
          </div>
          <div
            className="relative order-1 aspect-[4/3] max-h-[40dvh] w-full min-w-0 overflow-hidden rounded-[22px] sm:aspect-[16/11] sm:max-h-[44dvh] sm:rounded-[28px] lg:order-2 lg:aspect-[16/10] lg:max-h-none"
            style={{ boxShadow: '0 40px 120px -30px rgba(99,102,241,0.45)' }}
          >
            {items.map((it, i) => <Frame key={i} i={i} n={n} p={p} item={it} label={label} />)}
          </div>
        </div>
        <div className="mx-auto mt-5 h-px w-full max-w-7xl bg-white/10 sm:mt-8"><motion.div className="h-px bg-white/70" style={{ width: bar }} /></div>
      </div>
    </section>
  );
}

/* ───────────── drifting strip ───────────── */
export function Marquee({ items, label = 'media.js → strip' }) {
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(p, [0, 1], ['6%', '-22%']);
  return (
    <div ref={ref} className="relative overflow-hidden py-10">
      <motion.div className="flex gap-5" style={{ x, width: 'max-content' }}>
        {items.map((it, i) => (
          <MediaSlot key={i} src={it.src} alt={it.alt} label={`${label}[${i}]`} className="h-56 w-[22rem] shrink-0 rounded-2xl sm:h-72 sm:w-[28rem]" />
        ))}
      </motion.div>
    </div>
  );
}
