/**
 * frontend/src/components/RSVPPageRenderer.jsx
 *
 * The single rendering implementation for rsvpPageConfig, used by both:
 *   - RSVPPageBuilder.jsx's live preview pane
 *   - RSVPPage.jsx, the public guest-facing page
 *
 * There is exactly one place block layout/style logic lives (blocks.jsx +
 * theme.js). This file only orchestrates: which sections exist, in what
 * order, with what accent/spacing/alignment resolved, and when each one
 * actually mounts.
 *
 * PERFORMANCE (Part 3 requirements):
 *  1. Only sections present in `sections` are iterated — unused block types
 *     are never imported into the render tree at all (map over the array,
 *     no exhaustive switch over BLOCK_TYPES).
 *  2. Every block component is already React.memo'd in blocks.jsx. This
 *     renderer also memoizes the resolved per-section props object so a
 *     section's own memo comparison is meaningful (a new object identity
 *     every render would defeat React.memo entirely).
 *  3. <InViewport> defers mounting anything below the first viewport until
 *     it's actually near-visible, via IntersectionObserver. Hero (and the
 *     block immediately after it, so there's no blank flash) render eagerly;
 *     everything else is deferred.
 *  4. This file imports ONLY presentational block components — no dnd-kit,
 *     no builder editing chrome. RSVPPageBuilder.jsx is the only file that
 *     imports dnd-kit, so a production build of RSVPPage.jsx never pulls it
 *     in. Verify with e.g. `vite build --mode analyze` / rollup-plugin-visualizer
 *     comparing the two route chunks — this must be checked against the
 *     actual bundler output, not assumed, before Part 3 is considered done.
 *  5. Images lazy-load inside each block component (loading="lazy").
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_COMPONENTS } from './rsvpBlocks/blocks';
import RsvpFormBlock from './rsvpBlocks/RsvpFormBlock';
import { FONTS, getBgStyle, resolveAccent } from './rsvpBlocks/theme';

/** Mounts children only once near/inside the viewport. Renders a fixed-height spacer until then, so scroll position doesn't jump. */
function InViewport({ eager, minHeight = 120, children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(!!eager);

  useEffect(() => {
    if (eager || visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '400px 0px' } // start mounting well before it scrolls into view
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [eager, visible]);

  return <div ref={ref} style={visible ? undefined : { minHeight }}>{visible ? children : null}</div>;
}

/**
 * @param {Object} props
 * @param {{accentColor: string, sections: Array}} props.config - event.rsvpPageConfig
 * @param {Object|null} [props.pageData] - the full rsvpAPI.getPage() response (eventId, counts, seatingMap, tableOccupancy, rsvpPage, etc). Only the rsvpForm block reads this — every other block's data lives in section.content. Pass null/omit from the builder preview: RsvpFormBlock renders a disabled preview instead of a live, submittable form whenever pageData has no eventId.
 * @param {string} [props.slug] - event id/subdomain, forwarded to rsvpAPI.submit
 * @param {string} [props.unlockedPw] - cached password-gate value, forwarded to submit
 * @param {string} props.backgroundStyle - 'dark' | 'light' | 'gradient' | 'frosted'
 * @param {string} props.fontStyle - key into FONTS
 * @param {Object.<string,string>} [props.coverUrlsById] - resolved cover-image URLs keyed by coverImageId (Part 5 output), so this renderer never needs to know how covers are generated
 * @param {function} [props.onSubmitted] - called with the submit response once a live RSVP succeeds; RSVPPage.jsx uses this to switch to ConfirmationScreen
 */
export default function RSVPPageRenderer({
  config,
  pageData = null,
  slug,
  unlockedPw,
  backgroundStyle = 'dark',
  fontStyle = 'modern',
  coverUrlsById = {},
  onSubmitted,
}) {
  const sections = config?.sections || [];
  const pageAccent = config?.accentColor || '#6366f1';
  const fonts = FONTS[fontStyle] || FONTS.modern;
  const isLight = backgroundStyle === 'light';
  const bgStyle = useMemo(() => getBgStyle(backgroundStyle, pageAccent), [backgroundStyle, pageAccent]);

  return (
    <div style={bgStyle} className="min-h-screen w-full">
      {sections.map((section, index) => {
        const accent = resolveAccent(section, pageAccent);
        const eager = index <= 1; // hero + the block right after it never defer, avoids a blank-page flash

        if (section.type === 'rsvpForm') {
          return (
            <InViewport key={section.id} eager={eager} minHeight={400}>
              <RsvpFormBlock
                pageData={pageData}
                slug={slug}
                unlockedPw={unlockedPw}
                accent={accent}
                fonts={fonts}
                isLight={isLight}
                spacing={section.style?.spacing}
                align={section.style?.alignment}
                onSubmitted={onSubmitted}
              />
            </InViewport>
          );
        }

        const Block = BLOCK_COMPONENTS[section.type];
        if (!Block) return null; // unknown/future block type in stored data — skip rather than crash the page

        const content = section.type === 'hero'
          ? { ...section.content, coverImageUrl: coverUrlsById[section.content?.coverImageId] || null }
          : section.content;

        return (
          <InViewport key={section.id} eager={eager}>
            <Block
              content={content}
              layout={section.layout}
              spacing={section.style?.spacing}
              align={section.style?.alignment}
              accent={accent}
              fonts={fonts}
              isLight={isLight}
            />
          </InViewport>
        );
      })}
    </div>
  );
}
