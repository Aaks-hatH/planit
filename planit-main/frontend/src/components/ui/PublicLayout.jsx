import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import PageHeader from './PageHeader';

/**
 * PublicLayout: nav + page header + content + footer in one wrapper, so a
 * secondary public page is a few lines instead of its own hand-built chrome.
 *
 *   <PublicLayout eyebrow="Company" title="About PlanIt" lead="...">
 *     ...page content, usually inside <section className="pi-section">...
 *   </PublicLayout>
 *
 * Pass `header={false}` when the page draws its own hero, `dark` for a dark page.
 */
export default function PublicLayout({
  children, eyebrow, title, lead, actions, meta, align, headerSize,
  header = true, dark = false, navActions, footer = true, footerCompact = false, width = 'content', className = '',
}) {
  return (
    <div
      className={`min-h-screen ${className}`}
      data-surface={dark ? 'dark' : undefined}
      style={{ background: 'var(--pi-bg)', color: 'var(--pi-text)', overflowX: 'clip' }}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] btn btn-primary">Skip to content</a>
      <PublicNav dark={dark} actions={navActions} />
      <main id="main" className="relative">
        {header && title && (
          <div className="pi-page-head">
            <PageHeader eyebrow={eyebrow} title={title} lead={lead} actions={actions} meta={meta} align={align} size={headerSize} />
          </div>
        )}
        {!header && <div aria-hidden="true" style={{ height: 'calc(var(--safe-top, 0px) + 5.25rem)' }} />}
        <div className={width === 'prose' ? 'mx-auto max-w-[var(--prose-max)] px-[var(--gutter)]' : 'mx-auto max-w-[var(--content-max)] px-[var(--gutter)]'}>
          {children}
        </div>
      </main>
      {footer && <PublicFooter compact={footerCompact} />}
    </div>
  );
}
