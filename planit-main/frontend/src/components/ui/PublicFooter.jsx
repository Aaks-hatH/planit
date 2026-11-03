import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useWhiteLabel } from '../../context/WhiteLabelContext';
import { FOOTER_COLUMNS, LEGAL_LINKS } from './navData';

/**
 * PublicFooter: shared footer for every public page. Sits on an ink surface
 * (data-surface="dark" re-themes the tokens inside it). White-label domains
 * get a quiet version with the client's name and "Powered by PlanIt" unless the
 * client has hidden it.
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
      <div className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)]">
        {!compact && (
          <div className="flex flex-col gap-6 border-b border-[var(--pi-border)] py-14 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-4">Free to start</p>
              <h2 className="t-h2 max-w-[18ch] text-[var(--pi-text)]">Plan it together. Run it seamlessly.</h2>
            </div>
            <Link to="/?start=events" className="btn btn-primary btn-lg self-start sm:self-auto">
              Start free <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4">
          {FOOTER_COLUMNS.map(col => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="t-label mb-4">{col.heading}</p>
              <ul className="space-y-2.5 text-sm">
                {col.links.map(l => (
                  <li key={col.heading + l.label}><Link to={l.to} className="inline-block py-0.5">{l.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--pi-border)] py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="pi-mark" aria-hidden="true" style={{ width: '1.5rem', height: '1.5rem', fontSize: '0.875rem' }}>P</span>
            <span>© {year} PlanIt. All rights reserved. Built by Aakshat Hariharan.</span>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">
            {LEGAL_LINKS.map(l => <Link key={l.to} to={l.to} className="py-0.5">{l.label}</Link>)}
            <Link to="/status" className="py-0.5">Status</Link>
          </nav>
        </div>
      </div>

      <div aria-hidden="true" className="pointer-events-none select-none text-center font-[family-name:var(--font-display)] font-bold leading-[0.8] text-white/[0.04]"
        style={{ fontSize: 'clamp(6rem, 24vw, 22rem)', letterSpacing: '-0.07em', marginBottom: '-0.12em' }}>
        PlanIt
      </div>
    </footer>
  );
}
