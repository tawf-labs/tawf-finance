import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// One entrance for the whole page: rise once when it scrolls in.
// MotionConfig reducedMotion="user" on the page turns the rise off.
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Headline entrance: each word rises out of its own mask, left to right.
export function Words({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(' ').map((w, i) => (
        <span key={i}>
          <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-top">
            <motion.span
              className="inline-block"
              initial={{ y: '110%' }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '0px 0px -10% 0px' }}
              transition={{ duration: 0.9, delay: delay + i * 0.055, ease: [0.22, 1, 0.36, 1] }}
            >
              {w}
            </motion.span>
          </span>{' '}
        </span>
      ))}
    </span>
  );
}

// Counts up to its value the first time it scrolls into view.
export function CountUp({ to, decimals = 0, className }: { to: number; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -15% 0px' });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!seen || reduce) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => ref.current && (ref.current.textContent = v.toFixed(decimals)) });
    return () => c.stop();
  }, [seen, reduce, to, decimals]);
  return <span ref={ref} className={className}>{(reduce ? to : 0).toFixed(decimals)}</span>;
}
