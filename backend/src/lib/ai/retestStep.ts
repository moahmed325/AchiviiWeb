/**
 * Weekly update M3.3a (RULE-5, RULE-6, WU-55, WU-56): the re-test step code puts first on the new week's first offered
 * practice day, and its easy version. Fixed text, so a stored step is read back the same way. Its title never matches
 * `TEST_STEP_TITLE`, so it is never the week's own test step; the load checks count it through `codeMadeRetestStep`.
 */
import type { DetailedStep } from './goalDecomposer.js';
import type { DayLayout } from './weekPlan.js';
import type { WeekTest } from './roadmap.js';
import type { CodeMadeTest } from '../safety/weekLoad.js';

/** What the week writer is given: the closing week's number and its stored test (WU-56 (2)). */
export interface Retest {
  ofWeek: number;
  test: WeekTest;
  /** M1.4: every day dated before this local date is stored not offered, so the re-test never goes there. */
  notOfferedBefore?: string;
  /** M3.4 (WU-41, WU-55, WU-59 (4)): a high-load first week back places the easy re-test from the start. */
  easy?: boolean;
}

/** Never change these, or stored re-test steps stop being recognised. */
const RETEST_FOCUS = "Your honest best on last week's test, done exactly as written.";
const RETEST_PITFALL = 'Changing the test to make it easier.';

/** WU-55: the fixed easy re-test, swapped in on the last attempt when only the re-test breaks a limit. */
export const EASY_RETEST_STEP = {
  title: 'Re-test: an easy version',
  instructions: "Do last week's test at an easy, comfortable effort, never all-out. Note what you did and how it felt.",
  passMark: 'No pass mark this time; just log what you did.',
  focusCue: 'Easy and comfortable all the way through.',
  pitfallToAvoid: 'Turning it into a hard effort.',
} as const;

/** `testStepFor`'s measured step for the re-tested week's test: "Re-test: " and the same first clause. */
export function retestStepFor(test: WeekTest, minutes: number): DetailedStep & { priority: number } {
  return {
    stepNumber: 0,
    title: `Re-test: ${test.instructions.split(/[.;]/)[0].slice(0, 80)}`,
    durationMinutes: minutes,
    instructions: test.instructions,
    focusCue: RETEST_FOCUS,
    pitfallToAvoid: RETEST_PITFALL,
    passMark: test.passIf,
    output: 'Your re-test result.',
    priority: 0,
    highLoad: false,
  };
}

export function easyRetestStep(minutes: number): DetailedStep & { priority: number } {
  return {
    stepNumber: 0,
    title: EASY_RETEST_STEP.title,
    durationMinutes: minutes,
    instructions: EASY_RETEST_STEP.instructions,
    focusCue: EASY_RETEST_STEP.focusCue,
    pitfallToAvoid: EASY_RETEST_STEP.pitfallToAvoid,
    passMark: EASY_RETEST_STEP.passMark,
    output: 'What you did and how it felt.',
    priority: 0,
    highLoad: false,
  };
}

/**
 * A re-test step code wrote, read from its fixed text (stored ones too): `measured` for `retestStepFor`'s step, `light`
 * for the easy one, null for any other step. The load checks count it as the code-made test step of that kind.
 */
export function codeMadeRetestStep(step: Pick<DetailedStep, 'title' | 'focusCue' | 'pitfallToAvoid'>): CodeMadeTest {
  if (step.title === EASY_RETEST_STEP.title && step.focusCue === EASY_RETEST_STEP.focusCue) return 'light';
  return step.title.startsWith('Re-test: ') && step.focusCue === RETEST_FOCUS && step.pitfallToAvoid === RETEST_PITFALL ? 'measured' : null;
}

/**
 * WU-56, item 5: the day the re-test goes on: the week's first practice day that is offered and comes before the test
 * day (the test day is the last practice day). Null when there is none: then there is no re-test.
 */
export function retestDayOf(layout: readonly Pick<DayLayout, 'dayNumber' | 'date' | 'isRestDay' | 'isTestDay'>[], notOfferedBefore?: string): number | null {
  const testDay = layout.find((day) => day.isTestDay)?.dayNumber ?? Infinity;
  const day = layout.find((item) => !item.isRestDay && !item.isTestDay && item.dayNumber < testDay && (!notOfferedBefore || item.date >= notOfferedBefore));
  return day?.dayNumber ?? null;
}
