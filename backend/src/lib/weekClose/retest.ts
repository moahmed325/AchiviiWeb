import type { RoadmapWeek } from '@prisma/client';

/**
 * Weekly update M3.3b (RULE-5, RULE-6, WU-20 (1), WU-58): what the app is told about the open week's re-test and the
 * daily-time check, worked out from the stored rows only. The app never reads `updateStatus` (RULE-3).
 */

/** The daily-time options the schedule step offers (`DAILY_MINUTES` in the frontend's `StepSchedule.tsx`). */
export const DAILY_MINUTES_OPTIONS = [30, 45, 60, 90] as const;

export type RetestLineReason = 'not_logged' | 'two_hard_weeks';

export interface RetestInfo {
  ofWeek: number;
  reason: RetestLineReason;
  logged: boolean;
}

export interface DailyTimeCheck {
  minutes: number;
  shorter: number[];
}

export type RetestWeek = Pick<RoadmapWeek, 'weekNumber' | 'status' | 'retestOfWeek' | 'updateStatus' | 'testResult' | 'dailyTimeAskedAt'> & {
  jumped?: boolean | null;
};

/** WU-58 (3): the key the test-result route adds to a result stored through the re-test path. */
export const RETEST_LOGGED_KEY = 'retestLoggedInWeek';

const openWeekOf = (weeks: readonly RetestWeek[]) => weeks.find((week) => week.status === 'active');

/** WU-53: only a stored `far_behind` counts; a jumped week, a fallback or no status ends a run. */
const isHard = (week: RetestWeek | undefined): boolean => Boolean(week && !week.jumped && week.updateStatus === 'far_behind');

/** A logged result in a usable shape (as `isLogged` in `update.ts` reads it). */
function isLogged(testResult: unknown): boolean {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return false;
  const { value, passed } = testResult as Record<string, unknown>;
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && typeof passed === 'boolean';
}

/** WU-58 (3): the re-tested week's result was stored through the re-test path during this open week. */
export function loggedInWeek(testResult: unknown, openWeek: number): boolean {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return false;
  return (testResult as Record<string, unknown>)[RETEST_LOGGED_KEY] === openWeek;
}

/** RULE-6: the re-tested week and the week before it both stored `far_behind`. */
function twoHardWeeks(weeks: readonly RetestWeek[], ofWeek: number): boolean {
  const byNumber = (n: number) => weeks.find((week) => week.weekNumber === n);
  return isHard(byNumber(ofWeek)) && isHard(byNumber(ofWeek - 1));
}

/**
 * WU-58 (1), (2): the open week's re-test, or null when the open week has no `retestOfWeek`. `two_hard_weeks` only when
 * the re-tested week has a result logged and both weeks stored `far_behind`; an unlogged test wins (`not_logged`).
 */
export function retestInfo(weeks: readonly RetestWeek[]): RetestInfo | null {
  const open = openWeekOf(weeks);
  if (!open || typeof open.retestOfWeek !== 'number') return null;
  const ofWeek = open.retestOfWeek;
  const of = weeks.find((week) => week.weekNumber === ofWeek);
  const logged = loggedInWeek(of?.testResult, open.weekNumber);
  const reason: RetestLineReason = isLogged(of?.testResult) && twoHardWeeks(weeks, ofWeek) ? 'two_hard_weeks' : 'not_logged';
  return { ofWeek, reason, logged };
}

/**
 * RULE-6, WU-7, WU-20 (1): the daily-time question, asked once per run of hard weeks and only when a shorter option
 * exists. Asked when the open week re-tests two hard weeks (the re-tested week and the week before it both
 * `far_behind`, whatever the line says), the open week was not asked yet, and no earlier week of the same run was
 * followed by a week that was asked.
 */
export function dailyTimeCheckOf(weeks: readonly RetestWeek[], dailyMinutes: number): DailyTimeCheck | null {
  const open = openWeekOf(weeks);
  if (!open || typeof open.retestOfWeek !== 'number' || open.dailyTimeAskedAt) return null;
  const ofWeek = open.retestOfWeek;
  if (!twoHardWeeks(weeks, ofWeek)) return null;
  const byNumber = (n: number) => weeks.find((week) => week.weekNumber === n);
  for (let n = ofWeek - 1; isHard(byNumber(n)); n -= 1) {
    if (byNumber(n + 1)?.dailyTimeAskedAt) return null;
  }
  const shorter = DAILY_MINUTES_OPTIONS.filter((option) => option < dailyMinutes);
  return shorter.length > 0 ? { minutes: dailyMinutes, shorter } : null;
}
