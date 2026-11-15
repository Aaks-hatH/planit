import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useWhiteLabel } from '../../context/WhiteLabelContext';
import { FOOTER_COLUMNS, LEGAL_LINKS } from './navData';
import PlanItMark from './PlanItMark';

/**
 * PublicFooter: shared footer for every public page. Sits on an ink surface
 * (data-surface="dark" re-themes the tokens inside it) with a thin blue LED
 * edge where it meets the page. White-label domains get a quiet version with
 * the client's name and "Powered by PlanIt" unless the client has hidden it.
 *
 * props: compact (drop the Start free button, for pages that already have one)
 */
export default function PublicFooter({ compact = false }) {
  const { wl, isWL } = useWhiteLabel();
  const year = new Date().getFullYear();

  if (isWL) {
    const name = wl?.branding?.companyName || wl?.clientName || '';
    const hide = wl?.branding?.hidePoweredBy;
    return (
      <footer className="pi-footer" data-surface="dark" style={{ background: 'var(--pi-ink-950)', paddingTop: 0 }}>
        <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center justify-between gap-3 px-[var(--gutter)] py-8 text-sm">
          <span>© {year} {name}</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.filter(l => l.label !== 'License').map(l => <Link key={l.to} to={l.to}>{l.label}</Link>)}
            <Link to="/help">Help</Link>
          </nav>
          {!hide && <span className="t-label">Powered by PlanIt</span>}
        </div>
      </footer>
    );
  }

  return (
    <footer className="pi-footer relative overflow-hidden" data-surface="dark" style={{ background: 'var(--pi-ink-950)', paddingTop: 0 }}>
      {/* LED edge: a hairline plus a soft glow bleeding down into the footer */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--pi-accent) 50%, transparent)', opacity: 0.6 }} />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-32 w-[40rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'var(--pi-accent)', opacity: 0.14 }} />

      <div className="relative mx-auto max-w-[var(--content-max)] px-[var(--gutter)]">
        <div className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:gap-16">
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5" aria-label="PlanIt home">
              <PlanItMark size={28} />
              <span className="pi-wordmark">PlanIt</span>
            </Link>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed">
              The planning hub for event teams and venues. Free to start.
            </p>
            {!compact && (
              <Link to="/?start=events" className="btn btn-primary btn-sm mt-6 inline-flex whitespace-nowrap">
                Start free <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map(col => (
              <nav key={col.heading} aria-label={col.heading}>
                <p className="t-label mb-4">{col.heading}</p>
                <ul className="space-y-1 text-sm">
                  {col.links.map(l => (
                    <li key={col.heading + l.label}><Link to={l.to} className="inline-block py-1">{l.label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--pi-border)] py-6 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between"
          style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom, 0px))' }}>
          <span>© {year} PlanIt. Built by Aakshat Hariharan.</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.map(l => <Link key={l.to} to={l.to} className="py-0.5">{l.label}</Link>)}
            <Link to="/status" className="py-0.5">Status</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
