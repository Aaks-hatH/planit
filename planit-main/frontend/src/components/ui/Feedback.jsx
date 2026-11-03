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

/** Skeleton blocks that mirror the layout they stand in for. */
export function Skeleton({ className = '', style, variant = 'text' }) {
  const v = { text: 'skeleton-text', title: 'skeleton-title', circle: 'skeleton-circle', card: 'skeleton-card' }[variant] || '';
  return <span className={`skeleton ${v} ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonList({ rows = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3 p-4">
          <Skeleton variant="circle" style={{ width: 36 }} />
          <div className="flex-1"><Skeleton style={{ width: `${60 + ((i * 13) % 30)}%` }} /><Skeleton style={{ width: '38%' }} /></div>
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
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
