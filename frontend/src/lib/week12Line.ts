import type { Week12Line } from '../types';

/**
 * Plan safety limits M1.3 (RULE-3, PSL-12, 02-feature.md section 6): the honest line under week 12's target when code
 * lowered it to a safe step. With the number the person named, the full line; without one, only the safe step. Null
 * when week 12 was not lowered.
 */
export function week12LineText(line: Week12Line | null | undefined): string | null {
  if (!line) return null;
  return line.goal
    ? `Week 12 aims at ${line.safe}, a safe step. Your ${line.goal} goal is the next step.`
    : `Week 12 aims at ${line.safe}, a safe step.`;
}
