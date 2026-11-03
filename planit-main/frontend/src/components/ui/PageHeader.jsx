import Reveal from './Reveal';

/**
 * PageHeader: the editorial heading block that opens each public page.
 * Mono eyebrow, a large display title, a lead paragraph, optional actions and
 * meta. Compose with PublicLayout, which supplies the nav offset.
 */
export default function PageHeader({ eyebrow, title, lead, actions, meta, align = 'left', size = 'h1', children, className = '' }) {
  const center = align === 'center';
  return (
    <div className={`pi-page-head-inner ${center ? 'text-center' : ''} ${className}`}>
      {eyebrow && <Reveal y={8}><p className="eyebrow mb-5">{eyebrow}</p></Reveal>}
      <Reveal delay={0.04}>
        <h1 className={`${size === 'display' ? 't-display' : 't-h1'} ${center ? 'mx-auto' : ''} max-w-[20ch] text-[var(--pi-text)]`}>{title}</h1>
      </Reveal>
      {lead && <Reveal delay={0.1}><p className={`t-lead mt-5 ${center ? 'mx-auto' : ''}`}>{lead}</p></Reveal>}
      {actions && <Reveal delay={0.16}><div className={`mt-8 flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>{actions}</div></Reveal>}
      {meta && <Reveal delay={0.2}><div className={`t-meta mt-6 flex flex-wrap gap-x-6 gap-y-1 ${center ? 'justify-center' : ''}`}>{meta}</div></Reveal>}
      {children}
    </div>
  );
}
