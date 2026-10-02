import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * Phone-only bar that keeps the one action within thumb reach once the hero has scrolled away.
 * It steps aside when the closing call to action is on screen so the page never shows two at once.
 */
export const StickyCta: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const pastHero = window.scrollY > window.innerHeight * 0.85;
      const finale = document.getElementById('start');
      const finaleInView = finale ? finale.getBoundingClientRect().top < window.innerHeight * 0.75 : false;
      setVisible(pastHero && !finaleInView);
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
    };
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 md:hidden transition-[transform,opacity,visibility] duration-500 ease-ascend ${
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-full opacity-0'
      }`}
    >
      <div className="border-t border-achievement/25 bg-background/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <Link
          to="/signup"
          className="btn-gold focus-ring flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-medium"
        >
          <span className="relative z-10">Begin your 90 days</span>
          <ArrowRight aria-hidden="true" strokeWidth={1.75} className="relative z-10 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
