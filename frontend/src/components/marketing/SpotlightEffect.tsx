import React, { useEffect } from 'react';

/**
 * Feeds the cursor position to any element with the `spotlight` class, so a soft gold light follows the pointer
 * across cards. One passive listener for the whole page; touch devices never hover, so they see nothing.
 */
export const SpotlightEffect: React.FC = () => {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const target = (event.target as Element | null)?.closest<HTMLElement>('.spotlight');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      target.style.setProperty('--my', `${event.clientY - rect.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

  return null;
};
