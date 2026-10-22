import type { DailyTask, RoadmapWeek } from '@prisma/client';
import { codeMadeRetestStep } from '../ai/retestStep.js';
import { parseStoredSteps } from '../carryForward.js';
import { TOTAL_WEEKS } from '../ai/roadmap.js';
import { isLogged } from './update.js';

/**
 * Weekly update M3.3b (RULE-5, RULE-6, WU-20 (1), WU-58): what the app is told about the open week's re-test and the
 * daily-time check, worked out from the stored rows only. The app never reads `updateStatus` (RULE-3).
 */

/** The daily-time options the schedule step offers (`DAILY_MINUTES` in the frontend's `StepSchedule.tsx`). */
export const DAILY_MINUTES_OPTIONS = [30, 45, 60, 90] as const;

export type RetestLineReason = 'break' | 'not_logged' | 'two_hard_weeks';

export interface RetestInfo {
  ofWeek: number;
  reason: RetestLineReason;
  logged: boolean;
  /** The day holding the measured re-test step: its task and date ('YYYY-MM-DD'). */
  taskId: string;
  date: string;
}

export interface DailyTimeCheck {
  minutes: number;
  shorter: number[];
}

export type RetestWeek = Pick<RoadmapWeek, 'weekNumber' | 'status' | 'retestOfWeek' | 'updateStatus' | 'testResult' | 'dailyTimeAskedAt'> & {
  /** M3.4: set on a first week back (M1.5a); missing on older callers. */
  breakDays?: number | null;
  jumped?: boolean | null;
};

export type RetestTask = Pick<DailyTask, 'id' | 'weekNumber' | 'dayNumber' | 'date' | 'detailedSteps'>;

/** WU-58 (3): the key the test-result route adds to a result stored through the re-test path. */
export const RETEST_LOGGED_KEY = 'retestLoggedInWeek';

const openWeekOf = (weeks: readonly RetestWeek[]) => weeks.find((week) => week.status === 'active');

/** WU-53: only a stored `far_behind` counts; a jumped week, a fallback or no status ends a run. */
const isHard = (week: RetestWeek | undefined): boolean => Boolean(week && !week.jumped && week.updateStatus === 'far_behind');

/** WU-58 (3): the re-tested week's result was stored through the re-test path during this open week. */
export function loggedInWeek(testResult: unknown, openWeek: number): boolean {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return false;
  return (testResult as Record<string, unknown>)[RETEST_LOGGED_KEY] === openWeek;
}

/** RULE-6: weeks `n` and `n - 1` both stored `far_behind`. */
function twoHardWeeks(weeks: readonly RetestWeek[], n: number): boolean {
  const byNumber = (k: number) => weeks.find((week) => week.weekNumber === k);
  return isHard(byNumber(n)) && isHard(byNumber(n - 1));
}

/** The open week's first day (in day order) holding the measured re-test step (`codeMadeRetestStep`), or null. */
function retestTaskOf(tasks: readonly RetestTask[], openWeek: number): RetestTask | null {
  const days = tasks.filter((task) => task.weekNumber === openWeek).sort((a, b) => a.dayNumber - b.dayNumber);
  return (
    days.find((task) =>
      parseStoredSteps(task.detailedSteps).some(
        (step) => typeof step.title === 'string' && codeMadeRetestStep(step as Parameters<typeof codeMadeRetestStep>[0]) === 'measured'
      )
    ) ?? null
  );
}

/**
 * WU-58 (1), (2): the open week's re-test, or null when the open week has no `retestOfWeek` or no day holds the
 * measured re-test step. `two_hard_weeks` only when the re-tested week has a result logged and both it and the week
 * before stored `far_behind`; an unlogged test wins (`not_logged`). M3.4 (WU-59 (5)): `break` first, when the open week
 * is a first week back (`breakDays`).
 */
export function retestInfo(weeks: readonly RetestWeek[], tasks: readonly RetestTask[]): RetestInfo | null {
  const open = openWeekOf(weeks);
  if (!open || typeof open.retestOfWeek !== 'number') return null;
  const day = retestTaskOf(tasks, open.weekNumber);
  if (!day) return null;
  const ofWeek = open.retestOfWeek;
  const of = weeks.find((week) => week.weekNumber === ofWeek);
  const logged = loggedInWeek(of?.testResult, open.weekNumber);
  const reason: RetestLineReason =
    typeof open.breakDays === 'number' ? 'break' : isLogged(of?.testResult) && twoHardWeeks(weeks, ofWeek) ? 'two_hard_weeks' : 'not_logged';
  return { ofWeek, reason, logged, taskId: day.id, date: day.date };
}

/**
 * RULE-6, WU-7, WU-20 (1): the daily-time question, asked once per run of hard weeks and only when a shorter option
 * exists. Asked when the two weeks before the open week both stored `far_behind` (with or without a re-test), the open
 * week is not week 12 (no week is written after it) and was not asked yet, and no earlier week of the same run was
 * followed by a week that was asked.
 */
export function dailyTimeCheckOf(weeks: readonly RetestWeek[], dailyMinutes: number): DailyTimeCheck | null {
  const open = openWeekOf(weeks);
  if (!open || open.weekNumber >= TOTAL_WEEKS || open.dailyTimeAskedAt) return null;
  if (!twoHardWeeks(weeks, open.weekNumber - 1)) return null;
  const byNumber = (n: number) => weeks.find((week) => week.weekNumber === n);
  for (let n = open.weekNumber - 2; isHard(byNumber(n)); n -= 1) {
    if (byNumber(n + 1)?.dailyTimeAskedAt) return null;
  }
  const shorter = DAILY_MINUTES_OPTIONS.filter((option) => option < dailyMinutes);
  return shorter.length > 0 ? { minutes: dailyMinutes, shorter } : null;
}
