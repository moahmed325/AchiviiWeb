import type { Goal, WeekTarget, WeekTest, WeeklyTestResult } from '../types';
import { formatPassIf, formatTarget } from './formatters';
import { nextCheckWeekOf, readyWeekOf } from './planLength';

/** B-109: the goal's length, where a light week's line needs it; missing is a 12-week plan. */
type LengthGoal = Partial<Pick<Goal, 'totalWeeks'>> | null | undefined;

/**
 * Weekly update M2.1 (RULE-19, WU-43): light weekly tests. On run10k, recomp, speech and spanish every week but 4, 8
 * and 12 has a light test, logged as done plus a note and never set against the target; the week's stored target is
 * the next check's. A test without `light` (every goal created before M2.1, every custom goal) reads as before.
 */

export const LIGHT_DONE_VALUE = 'Done';

export function isLightTest(test: Pick<WeekTest, 'light'> | null | undefined): boolean {
  return test?.light === true;
}

/**
 * WU-43 (1): the big-test week a light week builds toward: weeks 1 to 3 week 4, 5 to 7 week 8, 9 to 11 week 12. B-109:
 * a shorter plan's own big weeks.
 */
export function nextCheckWeek(weekNumber: number, goal?: LengthGoal): number {
  return nextCheckWeekOf(weekNumber, goal);
}

/** Requirement 8: how a light week shows its target, exactly. B-109: a shorter plan's ready week keeps its final target. */
export function nextCheckLine(weekNumber: number, target: WeekTarget, goal?: LengthGoal): string {
  if (readyWeekOf(goal) === weekNumber) return `Ready week, your final target: ${formatTarget(target)}`;
  return `Next check, week ${nextCheckWeek(weekNumber, goal)}: ${formatTarget(target)}`;
}

/** Requirement 7: what "I did it" saves; the server's result check takes it as it is. */
export function lightTestResult(note: string): WeeklyTestResult {
  const trimmed = note.trim();
  return trimmed ? { value: LIGHT_DONE_VALUE, passed: true, note: trimmed } : { value: LIGHT_DONE_VALUE, passed: true };
}

/**
 * A week's target as a screen shows it: the next check in a light week, else as before. `format` is the screen's own
 * target text for any other week (Progress and Achievement keep theirs).
 */
export function weekTargetText(
  weekNumber: number,
  target: WeekTarget,
  test: WeekTest | null | undefined,
  format: (target: WeekTarget) => string | null = formatTarget,
  goal?: LengthGoal
): string {
  return isLightTest(test) ? nextCheckLine(weekNumber, target, goal) : format(target) ?? '';
}

/** A week's test in one line: a light test by its instructions (its pass mark is only "Done as written"), else as before. */
export function weekTestText(test: WeekTest): string {
  return isLightTest(test) ? test.instructions : formatPassIf(test.passIf) || test.instructions;
}
