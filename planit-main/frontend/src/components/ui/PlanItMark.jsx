/**
 * PlanItMark: the PlanIt logo (same artwork as /planit-icon.svg and the Home
 * page mark). Use this instead of a text "P" badge anywhere the brand appears.
 *
 * props: size (px, default 28), ring (hairline outline so the dark tile stays
 *        visible on dark surfaces, default true), className, style
 */
export default function PlanItMark({ size = 28, ring = true, className = '', style, title = 'PlanIt' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none"
      role="img" aria-label={title}
      className={`pi-logo ${className}`}
      style={{ flexShrink: 0, borderRadius: size * 0.25, boxShadow: ring ? '0 0 0 1px var(--pi-border, rgba(127,127,127,0.28))' : undefined, ...style }}
    >
      <rect width="32" height="32" rx="8" fill="#111111" />
      <rect x="6" y="9" width="20" height="16" rx="2.5" fill="white" />
      <rect x="6" y="9" width="20" height="6" rx="2.5" fill="#111111" />
      <rect x="6" y="12" width="20" height="3" fill="#111111" />
      <rect x="11" y="7" width="2.5" height="5" rx="1.25" fill="white" />
      <rect x="18.5" y="7" width="2.5" height="5" rx="1.25" fill="white" />
      <path d="M12 18.5l2.8 2.8 5.2-5.2" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
