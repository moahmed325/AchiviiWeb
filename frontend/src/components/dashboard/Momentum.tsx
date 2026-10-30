import React from 'react';
import { VisuallyHidden } from '../ui';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { practiceTimeLabel } from '../../lib/dashboard';

const SEEN_PREFIX = 'achivii:dashboard-seen:';
const COUNT_MS = 1200;

/** The count shown at the last visit, or null on a first visit (or when storage is unavailable). Per-viewer only. */
function useLastSeen(goalId: string, count: number): number | null {
  const [seen] = React.useState<number | null>(() => {
    try {
      const raw = window.localStorage.getItem(SEEN_PREFIX + goalId);
      const value = raw === null ? null : Number(raw);
      return value !== null && Number.isFinite(value) ? value : null;
    } catch {
      return null;
    }
  });
  React.useEffect(() => {
    try {
      window.localStorage.setItem(SEEN_PREFIX + goalId, String(count));
    } catch {
      // A private window or blocked storage: the count simply starts from zero next time.
    }
  }, [goalId, count]);
  return seen;
}

/** Counts from `from` up to `to` with an ease-out, once. Reduced motion shows `to` at once. */
function useCountUp(from: number, to: number): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = React.useState(reduced || from >= to ? to : from);
  React.useEffect(() => {
    if (reduced || from >= to || typeof window.requestAnimationFrame !== 'function') {
      setValue(to);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (time: number) => {
      const t = Math.min(1, (time - startedAt) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [from, to, reduced]);
  return value;
}

/**
 * The page's reward: every session ever done, counted up on arrival from where it stood at the last visit, with the
 * growth since then named. It only ever counts what was really done.
 */
export const Momentum: React.FC<{ goalId: string; sessions: number; minutes: number }> = ({ goalId, sessions, minutes }) => {
  const seen = useLastSeen(goalId, sessions);
  const from = seen !== null && seen <= sessions ? seen : 0;
  const shown = useCountUp(from, sessions);
  const gained = seen !== null && sessions > seen ? sessions - seen : 0;
  const label = sessions === 1 ? 'session done' : 'sessions done';

  return (
    <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-2 sm:text-right">
      <p className="dash-count tabular text-tally text-achievement" data-gained={gained > 0 || undefined} aria-hidden="true">
        {shown}
      </p>
      <VisuallyHidden>{sessions + ' ' + label + ', ' + practiceTimeLabel(minutes) + ' of practice.'}</VisuallyHidden>
      <div className="flex flex-col gap-1 sm:items-end" aria-hidden="true">
        <p className="text-body text-text">{label}</p>
        {minutes > 0 && <p className="text-small text-text-secondary">{practiceTimeLabel(minutes)} of practice</p>}
        {gained > 0 && (
          <p className="dash-gain mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-ui-mono text-micro text-achievement">
            +{gained} since your last visit
          </p>
        )}
      </div>
      {gained > 0 && <VisuallyHidden>{gained + ' more since your last visit.'}</VisuallyHidden>}
    </div>
  );
};
