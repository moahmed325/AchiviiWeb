import type { DetailedStep } from './goalDecomposer.js';

export function fitStepMinutes(steps: DetailedStep[], total: number): DetailedStep[] {
  if (steps.length === 0 || total <= 0) return steps.map((step) => ({ ...step }));
  const next = steps.map((step) => ({ ...step, durationMinutes: Math.max(0, step.durationMinutes || 0) }));
  const sum = next.reduce((totalMinutes, step) => totalMinutes + step.durationMinutes, 0);
  if (sum === total) return next;

  if (sum <= 0) {
    const base = Math.floor(total / next.length);
    let leftover = total - base * next.length;
    return next.map((step) => {
      const extra = leftover > 0 ? 1 : 0;
      leftover -= extra;
      return { ...step, durationMinutes: base + extra };
    });
  }

  let used = 0;
  return next.map((step, index) => {
    if (index === next.length - 1) {
      return { ...step, durationMinutes: Math.max(1, total - used) };
    }
    const room = total - used - (next.length - index - 1);
    const share = Math.min(room, Math.max(1, Math.round((step.durationMinutes / sum) * total)));
    used += share;
    return { ...step, durationMinutes: share };
  });
}
