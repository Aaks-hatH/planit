import { motion, useReducedMotion } from 'framer-motion';

/**
 * Scroll-triggered entrance. Plays once, uses transform + opacity only, and
 * renders statically when the visitor prefers reduced motion.
 */
export default function Reveal({ children, delay = 0, y = 18, as = 'div', className = '', amount = 0.2, ...rest }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (reduce) return <Tag className={className} {...rest}>{children}</Tag>;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
