import React, { useEffect, useRef } from 'react';

/** A hairline of gold along the top edge that fills as the reader climbs the page. Decorative; updates without re-rendering. */
export const ScrollThread: React.FC = () => {
  const bar = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      const heroProgress = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
      document.documentElement.style.setProperty('--hero-p', heroProgress.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty('--hero-p');
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[44] h-[2px]">
      <span
        ref={bar}
        className="block h-full origin-left bg-gradient-to-r from-gold-deep via-achievement to-gold-bright shadow-[0_0_14px_rgba(200,169,107,0.7)]"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
};
