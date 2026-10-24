import type { DayNinetyLine, Goal, Week12Line } from '../types';

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

/** Checkpoints (RULE-11, section 6): the day-90 line, word for word. */
export function dayNinetyLineText(line: DayNinetyLine): string {
  return `Day-90 target: ${line.target}. Your goal: ${line.goal}.`;
}

/**
 * Checkpoints (RULE-11): the note under week 12's target wherever `week12Line` shows: the day-90 line while an accepted
 * checkpoint offer stands, else the honest week 12 line, else null.
 */
export function week12NoteText(goal: Pick<Goal, 'week12Line' | 'dayNinetyLine'>): string | null {
  return goal.dayNinetyLine ? dayNinetyLineText(goal.dayNinetyLine) : week12LineText(goal.week12Line);
}
