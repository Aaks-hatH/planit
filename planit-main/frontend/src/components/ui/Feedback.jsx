import { Check } from 'lucide-react';

/** Empty state: an icon, a plain-language title, one sentence of guidance, and the next action. */
export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`empty-state ${className}`}>
      {Icon && <div className="empty-state-icon"><Icon className="h-5 w-5" strokeWidth={1.75} /></div>}
      <p className="empty-state-title">{title}</p>
      {children && <p className="empty-state-text">{children}</p>}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ── Skeletons ───────────────────────────────────────────────────────────────
 * Loading placeholders that mirror the layout they stand in for, so the page
 * does not jump when the data arrives. `dark` is for always-dark pages.
 *
 *   Skeleton            one block (text / title / circle / card)
 *   SkeletonList        rows with an avatar, inside cards
 *   SkeletonRows        flat rows, for activity feeds and logs
 *   SkeletonEventCards  grid of event cards (cover, title, meta)
 *   SkeletonStats       a row of stat tiles
 *   SkeletonTable       a bordered table: header + rows
 *   SkeletonSection     title + a few lines + cards, a generic panel
 *   SkeletonPage        full page shell (header, tabs, content), for gates
 * ------------------------------------------------------------------------- */
export function Skeleton({ className = '', style, variant = 'text', dark = false }) {
  const v = { text: 'skeleton-text', title: 'skeleton-title', circle: 'skeleton-circle', card: 'skeleton-card' }[variant] || '';
  return <span className={`skeleton ${v} ${dark ? 'skeleton-dark' : ''} ${className}`} style={style} aria-hidden="true" />;
}

/** Announces "Loading" once to screen readers; the blocks inside are hidden from them. */
function Busy({ className = '', style, label = 'Loading', children }) {
  return (
    <div className={className} style={style} role="status" aria-busy="true" aria-label={label}>
      {children}
      <span className="sr-only">{label}</span>
    </div>
  );
}

const pct = (i, base = 55, spread = 35) => `${base + ((i * 17) % spread)}%`;

export function SkeletonList({ rows = 4, columns = 1, className = '' }) {
  return (
    <Busy className={`${columns > 1 ? 'grid gap-3 lg:grid-cols-2' : 'space-y-3'} ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <Skeleton variant="circle" style={{ width: 36 }} />
          <div className="flex-1"><Skeleton style={{ width: `${60 + ((i * 13) % 30)}%` }} /><Skeleton style={{ width: '38%' }} /></div>
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonRows({ rows = 6, className = '', dark = false }) {
  return (
    <Busy className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: '1px solid var(--pi-border)' }}>
          <Skeleton dark={dark} style={{ width: 56, height: 20, borderRadius: 6 }} />
          <div className="flex-1"><Skeleton dark={dark} style={{ width: pct(i) }} /><Skeleton dark={dark} style={{ width: '30%' }} /></div>
          <Skeleton dark={dark} style={{ width: 48, height: 12 }} />
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonEventCards({ count = 6, className = '', dark = false }) {
  return (
    <Busy className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`} label="Loading events">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden" style={dark ? { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' } : undefined}>
          <Skeleton dark={dark} style={{ height: 150, borderRadius: 0 }} />
          <div className="p-4">
            <Skeleton dark={dark} variant="title" style={{ width: pct(i, 55, 30), marginBottom: 12 }} />
            <Skeleton dark={dark} style={{ width: '42%' }} />
            <Skeleton dark={dark} style={{ width: '58%' }} />
            <div className="mt-3 flex gap-2">
              <Skeleton dark={dark} style={{ width: 64, height: 22, borderRadius: 999 }} />
              <Skeleton dark={dark} style={{ width: 52, height: 22, borderRadius: 999 }} />
            </div>
          </div>
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonStats({ count = 4, className = '', dark = false }) {
  return (
    <Busy className={`grid grid-cols-2 gap-3 lg:grid-cols-4 ${className}`} label="Loading stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4" style={dark ? { background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' } : undefined}>
          <Skeleton dark={dark} style={{ width: '45%', height: 10 }} />
          <Skeleton dark={dark} style={{ width: '60%', height: 28, marginTop: 10 }} />
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonTable({ rows = 6, cols = 5, className = '', dark = false }) {
  return (
    <Busy className={`overflow-hidden rounded-xl border border-[var(--pi-border)] ${className}`} label="Loading table">
      <div className="flex gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--pi-border)', background: 'var(--pi-surface-sunk)' }}>
        {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} dark={dark} style={{ flex: 1, height: 10, margin: 0 }} />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5" style={{ borderBottom: r === rows - 1 ? 'none' : '1px solid var(--pi-border)' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} dark={dark} style={{ flex: c === 0 ? 1.6 : 1, margin: 0, width: c === 0 ? undefined : pct(r + c, 50, 40) }} />
          ))}
        </div>
      ))}
    </Busy>
  );
}

export function SkeletonSection({ cards = 3, className = '', dark = false }) {
  return (
    <Busy className={`space-y-5 ${className}`}>
      <div>
        <Skeleton dark={dark} variant="title" />
        <Skeleton dark={dark} style={{ width: '75%' }} />
        <Skeleton dark={dark} style={{ width: '50%' }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => <Skeleton key={i} dark={dark} variant="card" />)}
      </div>
    </Busy>
  );
}

/** Public/guest page skeleton: a tall cover block, then a title and a couple of cards. For RSVP, ticket and invite pages. */
export function SkeletonHeroPage({ dark = true, bg, className = '' }) {
  return (
    <Busy className={`min-h-screen ${className}`} style={{ background: bg || (dark ? '#0a0a12' : 'var(--pi-bg, #f7f7f9)') }}>
      <Skeleton dark={dark} style={{ height: 260, borderRadius: 0, margin: 0 }} />
      <div className="mx-auto max-w-xl p-6"><SkeletonSection dark={dark} cards={2} /></div>
    </Busy>
  );
}

/** Whole-page skeleton for route gates: header bar, tab strip, then content. */
export function SkeletonPage({ dark = false, cards = 3, className = '' }) {
  const bg = dark ? '#0a0a12' : 'var(--pi-bg, #f7f7f9)';
  return (
    <Busy className={`min-h-screen ${className}`} style={{ background: bg }}>
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'var(--pi-border)'}` }}>
        <Skeleton dark={dark} style={{ width: 32, height: 32, borderRadius: 8, margin: 0 }} />
        <div className="flex-1"><Skeleton dark={dark} style={{ width: 180, height: 14, margin: '0 0 6px' }} /><Skeleton dark={dark} style={{ width: 110, height: 10, margin: 0 }} /></div>
        <Skeleton dark={dark} style={{ width: 32, height: 32, borderRadius: 8, margin: 0 }} />
        <Skeleton dark={dark} style={{ width: 32, height: 32, borderRadius: 8, margin: 0 }} />
      </div>
      <div className="mx-auto max-w-screen-xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-2">
          {[88, 72, 96, 64].map((w, i) => <Skeleton key={i} dark={dark} style={{ width: w, height: 32, borderRadius: 999, margin: 0 }} />)}
        </div>
        <SkeletonSection cards={cards} dark={dark} />
      </div>
    </Busy>
  );
}

/** Status pill: always a dot plus a word, never colour alone. tone: live | wait | alert | seated | venue | idle */
export function StatusPill({ tone = 'idle', children, pulse = false, size, className = '' }) {
  const t = tone === 'idle' ? '' : `status-${tone}`;
  return <span className={`status ${t} ${pulse ? 'status-pulse' : ''} ${size === 'lg' ? 'status-lg' : ''} ${className}`}>{children}</span>;
}

/** Numeric statistic: mono label over a tabular display figure. */
export function Stat({ label, value, hint, tone, className = '' }) {
  const color = tone ? { live: 'var(--pi-live)', wait: 'var(--pi-wait)', alert: 'var(--pi-alert)', seated: 'var(--pi-seated)' }[tone] : undefined;
  return (
    <div className={className}>
      <p className="t-label">{label}</p>
      <p className="t-stat mt-2" style={color ? { color } : undefined}>{value}</p>
      {hint && <p className="t-meta mt-1.5">{hint}</p>}
    </div>
  );
}

/** Success tick that pops in and rings out once. Respects reduced motion via global CSS. */
export function SuccessCheck({ size = 48, className = '' }) {
  return (
    <span className={`animate-success animate-success-ring inline-grid place-items-center rounded-full ${className}`}
      style={{ width: size, height: size, background: 'var(--pi-live)', color: '#fff' }} role="img" aria-label="Success">
      <Check style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={3} />
    </span>
  );
}
