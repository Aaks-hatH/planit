import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Modal: accessible dialog primitive. Portals to <body>, locks scroll, traps
 * Tab inside, closes on Escape / backdrop, restores focus, and becomes a bottom
 * sheet on phones. Use `danger` for destructive confirmations.
 *
 *   <Modal open={open} onClose={close} title="Delete event?" description="..."
 *          footer={<><button className="btn btn-secondary" onClick={close}>Cancel</button>
 *                   <button className="btn btn-danger-solid" onClick={del}>Delete event</button></>}>
 */
export default function Modal({ open, onClose, title, description, children, footer, size = 'md', danger = false, dismissible = true, sheet = true }) {
  const reduce = useReducedMotion();
  const panel = useRef(null);
  const last = useRef(null);

  useEffect(() => {
    if (!open) return;
    last.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = panel.current?.querySelector('[data-autofocus], input, textarea, select, button:not([data-close])');
      (el || panel.current)?.focus?.();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); onClose?.(); }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = panel.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
      last.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`modal-backdrop ${sheet ? 'modal-sheet-mobile' : ''}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }}
        >
          <motion.div
            ref={panel} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
            className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} style={{ animation: 'none' }}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {(title || dismissible) && (
              <div className="modal-head">
                <div className="min-w-0">
                  {title && <h2 className="t-h3" style={danger ? { color: 'var(--pi-alert)' } : undefined}>{title}</h2>}
                  {description && <p className="t-meta mt-1.5" style={{ fontSize: '0.875rem' }}>{description}</p>}
                </div>
                {dismissible && (
                  <button type="button" data-close className="btn btn-ghost btn-icon -mr-2 -mt-1 shrink-0" onClick={onClose} aria-label="Close dialog"><X className="h-4 w-4" /></button>
                )}
              </div>
            )}
            {children && <div className="modal-body">{children}</div>}
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
