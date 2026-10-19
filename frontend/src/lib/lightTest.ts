import type { WeekTarget, WeekTest, WeeklyTestResult } from '../types';
import { formatPassIf, formatTarget } from './formatters';

/**
 * Weekly update M2.1 (RULE-19, WU-43): light weekly tests. On run10k, recomp, speech and spanish every week but 4, 8
 * and 12 has a light test, logged as done plus a note and never set against the target; the week's stored target is
 * the next check's. A test without `light` (every goal created before M2.1, every custom goal) reads as before.
 */

export const BIG_TEST_WEEKS = [4, 8, 12];
export const LIGHT_DONE_VALUE = 'Done';

export function isLightTest(test: Pick<WeekTest, 'light'> | null | undefined): boolean {
  return test?.light === true;
}

/** WU-43 (1): the big-test week a light week builds toward: weeks 1 to 3 week 4, 5 to 7 week 8, 9 to 11 week 12. */
export function nextCheckWeek(weekNumber: number): number {
  return BIG_TEST_WEEKS.find((week) => week >= weekNumber) ?? 12;
}

/** Requirement 8: how a light week shows its target, exactly. */
export function nextCheckLine(weekNumber: number, target: WeekTarget): string {
  return `Next check, week ${nextCheckWeek(weekNumber)}: ${formatTarget(target)}`;
}

/** Requirement 7: what "I did it" saves; the server's result check takes it as it is. */
export function lightTestResult(note: string): WeeklyTestResult {
  const trimmed = note.trim();
  return trimmed ? { value: LIGHT_DONE_VALUE, passed: true, note: trimmed } : { value: LIGHT_DONE_VALUE, passed: true };
}

/** A week's target as the Roadmap and Progress show it: the next check in a light week, else as before. */
export function weekTargetText(weekNumber: number, target: WeekTarget, test: WeekTest | null | undefined): string {
  return isLightTest(test) ? nextCheckLine(weekNumber, target) : formatTarget(target);
}

/** A week's test in one line: a light test by its instructions (its pass mark is only "Done as written"), else as before. */
export function weekTestText(test: WeekTest): string {
  return isLightTest(test) ? test.instructions : formatPassIf(test.passIf) || test.instructions;
}
