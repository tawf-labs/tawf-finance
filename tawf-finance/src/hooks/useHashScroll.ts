import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to location.hash once the target exists and the layout has settled.
 * The app renders after the browser has already tried the fragment, so a full page load
 * (for example from a footer link on another page) would otherwise stay at the top.
 * It keeps aligning the section for ~2s while content above it settles (fonts, images,
 * reveal and sticky sections), honours the section's scroll-margin, and stops as soon as
 * the visitor scrolls or touches the page. Reduced motion gets an instant jump either way.
 */
export function useHashScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    let stopped = false;
    const align = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
    };
    const stop = () => {
      stopped = true;
    };
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    events.forEach((e) => window.addEventListener(e, stop, { passive: true, once: true }));

    const started = performance.now();
    let timer: number | undefined;
    const tick = () => {
      if (stopped) return;
      align();
      if (performance.now() - started < 2000) timer = window.setTimeout(tick, 100);
    };
    const raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, [pathname, hash]);
}
