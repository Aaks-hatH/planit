import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';

/**
 * Sheet: one panel, two shapes.
 *   phones   (< 640px)  a bottom sheet: grabs the full width, has a drag handle you can pull down to
 *                       close, a sticky title and a sticky footer that clears the home indicator.
 *   desktop  (>= 640px) a centred dialog.
 *
 * It is deliberately Tailwind-only (no .btn / .modal classes) so it looks the same on every page,
 * including the homepage, whose own stylesheet defines a different `.btn`.
 *
 *   <Sheet open={open} onClose={close} title="Add guest" subtitle="..." icon={UserPlus}
 *          footer={<button>Save</button>}>...</Sheet>
 *
 * ResponsivePanel (bottom of this file) is the same thing, except that on desktop it opens as a
 * small popover under its trigger instead of a dialog in the middle of the screen.
 */

// Several sheets can be open at once (e.g. a confirm on top of a panel). Only the top one answers
// Escape, and the page only becomes scrollable again when the last one closes.
const stack = [];
let scrollLocks = 0;
let prevOverflow = '';
function lockScroll() {
  if (scrollLocks++ === 0) { prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
}
function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = prevOverflow;
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
  xl: 'sm:max-w-2xl',
  '2xl': 'sm:max-w-4xl',
};

const FOCUSABLE = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export default function Sheet({
  open, onClose, title, subtitle, icon: Icon, children, footer,
  size = 'md', dismissible = true, fullHeight = false, zClass = 'z-[70]', bodyClassName = '',
}) {
  const reduce = useReducedMotion();
  const isDesktop = useIsDesktop();
  const panel = useRef(null);
  const dragControls = useDragControls();
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const me = Symbol('sheet');
    stack.push(me);
    const lastFocus = document.activeElement;
    lockScroll();

    // Focus the panel (or an element that asked for it). We do not focus the first input by default:
    // on a phone that would raise the keyboard before the person has even read the sheet.
    const t = setTimeout(() => {
      const el = panel.current?.querySelector('[data-autofocus]');
      (el || panel.current)?.focus?.({ preventScroll: true });
    }, 40);

    const onKey = (e) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); closeRef.current?.(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const f = [...panel.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0]; const end = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(me); if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      try { lastFocus?.focus?.({ preventScroll: true }); } catch { /* ignore */ }
    };
  }, [open, dismissible]);

  if (typeof document === 'undefined') return null;

  const motionProps = isDesktop
    ? {
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 },
        transition: { duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] },
      }
    : {
        initial: reduce ? { opacity: 0 } : { y: '100%' },
        animate: reduce ? { opacity: 1 } : { y: 0 },
        exit: reduce ? { opacity: 0 } : { y: '100%' },
        transition: { duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] },
        // Pull the handle down to dismiss. Only the handle/title strip starts a drag, so scrolling the body is unaffected.
        drag: dismissible && !reduce ? 'y' : false,
        dragControls,
        dragListener: false,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 0.6 },
        onDragEnd: (_e, info) => { if (dismissible && (info.offset.y > 110 || info.velocity.y > 650)) closeRef.current?.(); },
      };

  const startDrag = (e) => { if (!isDesktop && dismissible) dragControls.start(e); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-backdrop"
          className={`fixed inset-0 ${zClass} flex items-end sm:items-center justify-center sm:p-6 bg-neutral-950/55 backdrop-blur-[2px]`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) closeRef.current?.(); }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            data-field16=""
            className={`relative flex w-full ${SIZES[size] || SIZES.md} flex-col bg-white text-neutral-900 shadow-2xl outline-none rounded-t-3xl sm:rounded-2xl ${fullHeight ? 'h-[94dvh]' : 'max-h-[92dvh]'} sm:h-auto sm:max-h-[min(88dvh,48rem)]`}
            {...motionProps}
          >
            {/* Handle + title: the strip you grab to pull the sheet down */}
            <div className="flex-shrink-0 touch-none sm:touch-auto" onPointerDown={startDrag}>
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden="true">
                <span className="h-1.5 w-10 rounded-full bg-neutral-300" />
              </div>
              {(title || dismissible) && (
                <div className="flex items-start gap-3 px-5 pb-3 pt-2 sm:pt-5">
                  {Icon && (
                    <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 pt-0.5">
                    {title && <h2 id={titleId} className="text-xl font-bold leading-tight text-neutral-900 sm:text-lg">{title}</h2>}
                    {subtitle && <p className="mt-1 text-sm leading-snug text-neutral-500">{subtitle}</p>}
                  </div>
                  {dismissible && (
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => closeRef.current?.()}
                      aria-label="Close"
                      className="-mr-2 -mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 active:bg-neutral-200"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'} ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="flex-shrink-0 rounded-b-2xl border-t border-neutral-100 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:pb-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * ResponsivePanel: a bottom sheet on phones, a popover on desktop.
 * The desktop popover is positioned against the nearest `relative` ancestor, so wrap the trigger and
 * the panel in a `relative` element. Clicking the trigger is NOT treated as an outside click, so the
 * trigger can simply toggle `open`.
 */
export function ResponsivePanel({
  open, onClose, title, subtitle, icon: Icon, children, footer,
  size = 'md', align = 'right', widthClass = 'w-[22rem]', dismissible = true,
}) {
  const isDesktop = useIsDesktop();
  const pop = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open || !isDesktop) return undefined;
    const onDown = (e) => {
      const host = pop.current?.parentElement;
      if (host && !host.contains(e.target)) closeRef.current?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current?.(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, isDesktop]);

  if (!isDesktop) {
    return <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} icon={Icon} footer={footer} size={size} dismissible={dismissible}>{children}</Sheet>;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={pop}
          role="dialog"
          aria-label={typeof title === 'string' ? title : undefined}
          data-field16=""
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-40 mt-2 ${widthClass} max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduce ? 0 : 0.15 }}
        >
          {(title || Icon) && (
            <div className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3">
              {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                {title && <h2 className="text-sm font-bold text-neutral-900">{title}</h2>}
                {subtitle && <p className="mt-0.5 text-xs leading-snug text-neutral-500">{subtitle}</p>}
              </div>
              {dismissible && (
                <button type="button" onClick={() => closeRef.current?.()} aria-label="Close" className="-mr-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className="max-h-[calc(100dvh-22rem)] min-h-[8rem] overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
          {footer && <div className="border-t border-neutral-100 px-4 py-3">{footer}</div>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
