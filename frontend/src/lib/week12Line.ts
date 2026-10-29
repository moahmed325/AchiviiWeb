import type { DayNinetyLine, Goal, Week12Line } from '../types';
import { finalWeekOf } from './planLength';

/**
 * Plan safety limits M1.3 (RULE-3, PSL-12, 02-feature.md section 6): the honest line under week 12's target when code
 * lowered it to a safe step. With the number the person named, the full line; without one, only the safe step. Null
 * when week 12 was not lowered.
 */
export function week12LineText(line: Week12Line | null | undefined, finalWeek = 12): string | null {
  if (!line) return null;
  // B-109: a shorter plan's final week (its week before the ready week) holds the target.
  return line.goal
    ? `Week ${finalWeek} aims at ${line.safe}, a safe step. Your ${line.goal} goal is the next step.`
    : `Week ${finalWeek} aims at ${line.safe}, a safe step.`;
}

/** Checkpoints (RULE-11, section 6): the day-90 line, word for word. */
export function dayNinetyLineText(line: DayNinetyLine): string {
  // B-109: a shorter plan has no day 90; its target is the final week's.
  return `${line.finalWeek === undefined ? 'Day-90 target' : 'Final target'}: ${line.target}. Your goal: ${line.goal}.`;
}

/**
 * Checkpoints (RULE-11): the note under week 12's target wherever `week12Line` shows: the day-90 line while an accepted
 * checkpoint offer stands, else the honest week 12 line, else null.
 */
export function week12NoteText(goal: Pick<Goal, 'week12Line' | 'dayNinetyLine'> & Partial<Pick<Goal, 'totalWeeks'>>): string | null {
  return goal.dayNinetyLine ? dayNinetyLineText(goal.dayNinetyLine) : week12LineText(goal.week12Line, finalWeekOf(goal));
}
