import React from 'react';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';

/**
 * A slow ribbon of the real journey names. Purely decorative (the full, linked list is in the Journeys
 * section), so it is hidden from assistive tech and holds still for people who prefer reduced motion.
 */
export const Marquee: React.FC = () => {
  const names = CERTIFIED_PATHWAYS.map((p) => p.title);
  const loop = [...names, ...names];

  return (
    <div aria-hidden="true" className="marquee relative overflow-hidden py-9">
      <div className="marquee-track">
        {loop.map((name, index) => (
          <span key={`${name}-${index}`} className="flex shrink-0 items-center whitespace-nowrap">
            <span className="px-8 text-[15px] font-medium tracking-[-0.01em] text-text-secondary">{name}</span>
            <span className="text-[10px] text-achievement">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
};
