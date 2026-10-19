/**
 * frontend/src/components/liquid/ScrollStory.jsx
 *
 * Apple-style scroll pieces that run on real pictures (set them in src/content/media.js).
 *
 *   MediaSlot   a picture frame with blueprint corner marks. Empty src shows a labelled placeholder.
 *   ZoomReveal  a card that grows to full screen as you scroll, caption fades in on top.
 *   ScrollStory a pinned stage: pictures cross-fade and push in while the copy swaps beside them.
 *   Marquee     slow horizontal strip of pictures that drifts sideways with scroll.
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

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
  const w = useTransform(p, [0, 0.5], ['min(70vw, 980px)', '100vw']);
  const h = useTransform(p, [0, 0.5], ['52vh', '100vh']);
  const r = useTransform(p, [0, 0.5], [34, 0]);
  const s = useTransform(p, [0, 0.8], [1.2, 1]);
  const shade = useTransform(p, [0.35, 0.85], [0.1, 0.6]);
  const ty = useTransform(p, [0.5, 0.85], [60, 0]);
  const to = useTransform(p, [0.5, 0.85], [0, 1]);

  if (reduce) {
    return (
      <section id={id} className="relative px-6 py-20">
        <MediaSlot src={media?.src} alt={media?.alt} label={label} className="mx-auto aspect-[16/10] max-w-5xl rounded-3xl" />
        <div className="mx-auto mt-8 max-w-2xl text-center"><h2 className="lq-display text-4xl">{title}</h2><p className="mt-3 text-white/60">{text}</p></div>
      </section>
    );
  }
  return (
    <section id={id} ref={ref} className="relative" style={{ height: '260vh' }}>
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div style={{ width: w, height: h, borderRadius: r, willChange: 'width, height' }} className="relative overflow-hidden">
          <MediaSlot src={media?.src} alt={media?.alt} label={label} className="h-full w-full" imgStyle={{ scale: s }} frame={false}>
            <motion.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
            <motion.div className="absolute inset-x-0 bottom-0 p-8 sm:p-14" style={{ y: ty, opacity: to }}>
              {kicker && <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-white/70">{kicker}</p>}
              <h2 className="lq-display max-w-4xl text-4xl text-white sm:text-6xl lg:text-7xl">{title}</h2>
              {text && <p className="mt-5 max-w-xl text-base text-white/75 sm:text-lg">{text}</p>}
            </motion.div>
          </MediaSlot>
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
    <motion.div className="absolute inset-x-0 top-0" style={{ opacity: op, y }}>
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-indigo-300/80">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</p>
      <h3 className="lq-display text-4xl text-white sm:text-5xl lg:text-6xl">{item.title}</h3>
      <p className="mt-5 max-w-md text-base leading-relaxed text-white/65 sm:text-lg">{item.text}</p>
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
      <section id={id} className="relative mx-auto max-w-6xl space-y-16 px-6 py-24">
        {items.map((it, i) => (
          <div key={i} className="grid items-center gap-8 md:grid-cols-2">
            <MediaSlot src={it.src} alt={it.alt} label={`${label}[${i}]`} className="aspect-[16/10] rounded-2xl" />
            <div><h3 className="lq-display text-3xl">{it.title}</h3><p className="mt-3 text-white/65">{it.text}</p></div>
          </div>
        ))}
      </section>
    );
  }
  return (
    <section id={id} ref={ref} className="relative" style={{ height: `${n * heightPerFrame + 40}vh` }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-6 sm:px-10 lg:px-16">
        {kicker && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.3em] text-white/45">{kicker}</p>}
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-16">
          <div className="relative order-2 h-[17rem] sm:h-[19rem] lg:order-1 lg:h-[26rem]">
            {items.map((it, i) => <Copy key={i} i={i} n={n} p={p} item={it} />)}
          </div>
          <div className="relative order-1 aspect-[16/11] w-full overflow-hidden rounded-[28px] lg:order-2 lg:aspect-[16/10]" style={{ boxShadow: '0 40px 120px -30px rgba(99,102,241,0.45)' }}>
            {items.map((it, i) => <Frame key={i} i={i} n={n} p={p} item={it} label={label} />)}
          </div>
        </div>
        <div className="mx-auto mt-8 h-px w-full max-w-7xl bg-white/10"><motion.div className="h-px bg-white/70" style={{ width: bar }} /></div>
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
