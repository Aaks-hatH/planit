import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, CornerDownRight, LogIn, Menu, X } from 'lucide-react';
import { useWhiteLabel } from '../../context/WhiteLabelContext';
import { PRODUCT, SOLUTIONS, RESOURCES } from './navData';
import { extractSlug } from './slug';

/**
 * PublicNav: the one navigation bar for every public PlanIt page.
 *
 * - Floating bar that picks up a firmer surface and shadow once you scroll.
 * - Product / Solutions / Resources open rich menus (hover on desktop, tap or
 *   keyboard everywhere). Escape and outside-click close them.
 * - "Sign in" opens a small panel: PlanIt has no global account, organizers
 *   enter through their event link, so that is what the panel asks for.
 * - Below `lg` it collapses to a full-height sheet with 44px targets and
 *   safe-area padding.
 * - On a white-label domain it shows the client's brand and a reduced set of
 *   links; PlanIt marketing is not leaked onto client domains.
 *
 * props: dark (render on a dark surface), actions (extra right-hand content),
 *        showCta (default true)
 */

const isActivePath = (pathname, to) => {
  const base = to.split(/[?#]/)[0] || '/';
  if (base === '/') return false;               // home links are never "current"
  return pathname === base || pathname.startsWith(base + '/');
};

function Brand({ isWL, name, logo }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 pr-2 shrink-0" aria-label={isWL ? (name || 'Home') : 'PlanIt home'}>
      {isWL && logo
        ? <img src={logo} alt={name || ''} className="h-7 w-auto max-w-[8rem] object-contain" />
        : <span className="pi-mark" aria-hidden="true">{(isWL ? (name || 'P') : 'P').charAt(0)}</span>}
      <span className="pi-wordmark">{isWL ? (name || '') : 'PlanIt'}</span>
    </Link>
  );
}

function MenuPanel({ items, align = 'left', onNavigate }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="menu"
      initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="menu absolute top-full mt-2 w-[22rem] p-2"
      style={{ [align === 'right' ? 'right' : 'left']: 0, transformOrigin: align === 'right' ? 'top right' : 'top left' }}
    >
      {items.map(({ to, icon: Icon, title, desc }) => (
        <Link key={title} to={to} role="menuitem" onClick={onNavigate}
          className="group flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-[var(--pi-surface-sunk)] focus-visible:bg-[var(--pi-surface-sunk)] focus-visible:outline-none">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--pi-border)] bg-[var(--pi-surface)] text-[var(--pi-text-muted)] transition-colors group-hover:border-[var(--pi-accent)] group-hover:text-[var(--pi-accent)]">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-[var(--pi-text)]">{title}</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--pi-text-muted)]">{desc}</span>
          </span>
        </Link>
      ))}
    </motion.div>
  );
}

function NavMenu({ id, label, items, open, setOpen, active, align }) {
  const isOpen = open === id;
  const timer = useRef(null);
  const hoverOK = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;
  const enter = () => { if (!hoverOK()) return; clearTimeout(timer.current); setOpen(id); };
  const leave = () => { if (!hoverOK()) return; timer.current = setTimeout(() => setOpen(o => (o === id ? null : o)), 120); };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        className="pi-nav-link"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-current={active ? 'page' : undefined}
        onClick={() => setOpen(isOpen ? null : id)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>{isOpen && <MenuPanel items={items} align={align} onNavigate={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}

function SignInPanel({ onDone }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const go = (e) => {
    e.preventDefault();
    const slug = extractSlug(value);
    if (!slug) { setError('Paste your event link, or the URL name you chose.'); return; }
    onDone();
    navigate(`/e/${slug}`);
  };
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="menu absolute right-0 top-full mt-2 w-[min(21rem,calc(100vw-2rem))] p-4"
      style={{ transformOrigin: 'top right' }}
    >
      <form onSubmit={go} noValidate>
        <label htmlFor="pi-signin-slug" className="label">Open your event</label>
        <div className="flex gap-2">
          <input
            id="pi-signin-slug" ref={inputRef} className="input" value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            placeholder="Event link or URL name" autoComplete="off" autoCapitalize="none" spellCheck={false}
            aria-invalid={error ? 'true' : undefined} aria-describedby="pi-signin-help"
          />
          <button type="submit" className="btn btn-primary btn-icon shrink-0" aria-label="Open event"><CornerDownRight className="h-4 w-4" /></button>
        </div>
        <p id="pi-signin-help" className={error ? 'field-error' : 'field-hint'}>
          {error || 'PlanIt has no separate account. You sign in on your event page, with your organizer password.'}
        </p>
      </form>
      <div className="menu-sep" />
      <Link to="/dashboard" onClick={onDone} className="menu-item"><LogIn className="h-4 w-4 text-[var(--pi-text-muted)]" />White-label client portal</Link>
      <Link to="/forgot-password" onClick={onDone} className="menu-item">Forgot your password?</Link>
    </motion.div>
  );
}

export default function PublicNav({ dark = false, actions = null, showCta = true }) {
  const { pathname } = useLocation();
  const { wl, isWL } = useWhiteLabel();
  const wlName = isWL ? (wl?.branding?.companyName || wl?.clientName || '') : '';
  const wlLogo = isWL ? (wl?.branding?.logoUrl || '') : '';
  const [open, setOpen] = useState(null);            // 'product' | 'solutions' | 'resources' | 'signin'
  const [sheet, setSheet] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  useEffect(() => { setOpen(null); setSheet(false); }, [pathname]);

  useEffect(() => {
    const onDown = (e) => { if (shellRef.current && !shellRef.current.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); setSheet(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sheet]);

  const closeAll = useCallback(() => { setOpen(null); setSheet(false); }, []);
  const anyActive = (items) => items.some(i => isActivePath(pathname, i.to));

  return (
    <header
      ref={shellRef}
      className="pi-nav-shell"
      data-surface={dark ? 'dark' : undefined}
      style={{ top: 'calc(0.75rem + var(--safe-top, 0px))', paddingTop: 0 }}
    >
      <nav className="pi-nav" data-scrolled={scrolled} aria-label="Primary">
        <Brand isWL={isWL} name={wlName} logo={wlLogo} />

        {!isWL ? (
          <div className="ml-2 hidden items-center gap-0.5 lg:flex">
            <NavMenu id="product" label="Product" items={PRODUCT} open={open} setOpen={setOpen} active={anyActive(PRODUCT)} />
            <Link to="/#features" className="pi-nav-link">Features</Link>
            <NavMenu id="solutions" label="Solutions" items={SOLUTIONS} open={open} setOpen={setOpen} active={anyActive(SOLUTIONS)} />
            <Link to="/about" className="pi-nav-link" aria-current={isActivePath(pathname, '/about') ? 'page' : undefined}>About</Link>
            <NavMenu id="resources" label="Resources" items={RESOURCES} open={open} setOpen={setOpen} active={anyActive(RESOURCES)} align="right" />
          </div>
        ) : (
          <div className="ml-2 hidden items-center gap-0.5 lg:flex">
            <Link to="/discover" className="pi-nav-link" aria-current={isActivePath(pathname, '/discover') ? 'page' : undefined}>Discover</Link>
            <Link to="/help" className="pi-nav-link" aria-current={isActivePath(pathname, '/help') ? 'page' : undefined}>Help</Link>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {actions}
          {!isWL && (
            <div className="relative hidden sm:block">
              <button type="button" className="pi-nav-link" aria-haspopup="dialog" aria-expanded={open === 'signin'} onClick={() => setOpen(open === 'signin' ? null : 'signin')}>
                Sign in
              </button>
              <AnimatePresence>{open === 'signin' && <SignInPanel onDone={closeAll} />}</AnimatePresence>
            </div>
          )}
          {showCta && !isWL && (
            <Link to="/?start=events" className="btn btn-primary btn-sm hidden whitespace-nowrap sm:inline-flex">
              Start free <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="button" className="pi-nav-link lg:hidden !px-2.5" style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}
            aria-label={sheet ? 'Close menu' : 'Open menu'} aria-expanded={sheet} aria-controls="pi-mobile-sheet"
            onClick={() => setSheet(s => !s)}
          >
            {sheet ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {sheet && (
          <>
            <motion.button
              type="button" aria-label="Close menu" tabIndex={-1}
              className="fixed inset-0 -z-10 cursor-default bg-[rgb(7_7_11/0.5)] lg:hidden" style={{ pointerEvents: 'auto' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)}
            />
            <motion.div
              id="pi-mobile-sheet"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="card absolute left-[var(--gutter)] right-[var(--gutter)] top-[calc(3.25rem+0.5rem)] overflow-y-auto p-3 lg:hidden"
              style={{ pointerEvents: 'auto', maxHeight: 'calc(100dvh - 5.5rem - var(--safe-top, 0px) - var(--safe-bottom, 0px))', boxShadow: 'var(--elev-4)' }}
            >
              {isWL ? (
                <div className="grid gap-1">
                  <Link to="/discover" className="menu-item" style={{ minHeight: 44 }}>Discover</Link>
                  <Link to="/help" className="menu-item" style={{ minHeight: 44 }}>Help</Link>
                </div>
              ) : (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-2 p-1">
                    <Link to="/?start=events" className="btn btn-primary btn-lg">Start free</Link>
                    <MobileSignIn onDone={closeAll} />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <Link to="/#features" className="menu-item" style={{ minHeight: 44 }}>Features</Link>
                    <Link to="/about" className="menu-item" style={{ minHeight: 44 }}>About</Link>
                  </div>
                  <div className="menu-sep" />
                  {[['Product', PRODUCT], ['Solutions', SOLUTIONS], ['Resources', RESOURCES]].map(([h, items]) => (
                    <div key={h} className="mb-1">
                      <p className="t-label px-2.5 pb-1 pt-2">{h}</p>
                      {items.map(({ to, icon: Icon, title }) => (
                        <Link key={title} to={to} className="menu-item" style={{ minHeight: 44 }}>
                          <Icon className="h-4 w-4 text-[var(--pi-text-muted)]" strokeWidth={1.75} />{title}
                        </Link>
                      ))}
                    </div>
                  ))}
                  <div style={{ height: 'var(--safe-bottom, 0px)' }} />
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function MobileSignIn({ onDone }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [value, setValue] = useState('');
  if (!show) return <button type="button" className="btn btn-secondary btn-lg" onClick={() => setShow(true)}>Sign in</button>;
  return (
    <form
      className="col-span-2 flex gap-2"
      onSubmit={(e) => { e.preventDefault(); const s = extractSlug(value); if (s) { onDone(); navigate(`/e/${s}`); } }}
    >
      <input autoFocus className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Event link or URL name" aria-label="Event link or URL name" autoCapitalize="none" spellCheck={false} />
      <button type="submit" className="btn btn-primary btn-icon shrink-0" aria-label="Open event"><CornerDownRight className="h-4 w-4" /></button>
    </form>
  );
}
