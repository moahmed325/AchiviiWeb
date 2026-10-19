import type { DailyTask } from '@prisma/client';
import { isHighLoadGoal } from '../highLoad.js';
import type { BreakLength, RecoveryProfile, Restart } from '../recovery/profile.js';

/**
 * Weekly update M1.5a (RULE-13, RULE-16's date side, WU-18, WU-25 (3), WU-29, WU-35): a close after a break. Pure: no
 * database, no clock, no environment. The switch is read by `planWeekMove`, which gives `breakDays` only when it is on.
 */

/** RULE-13: a gap of this many days or more is a break (the new week would already have ended). */
export const BREAK_FROM_GAP_DAYS = 7;

/** WU-35 (3): a break this long or longer picks the return rule's `3+ weeks` entry; shorter, `1-2 weeks`. */
export const LONG_BREAK_DAYS = 21;

/** Section 6: the line an automatic close after a break saves. `{date}` is stored as written; the app fills it in. */
export const WELCOME_BACK_INSIGHT = 'Welcome back. Your plan picks up from here and now ends on {date}.';

const dayIndex = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const isDate = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dayIndex(date));

/**
 * WU-18: the break's length in days, from the last day of the closing week with a done step (its first day if none was
 * done) to `returnedOn`, the local date of the first open that tried to close the week. `weekFirstDay` is used when the
 * week has no readable row. Never below 0.
 */
export function breakLength(
  closingTasks: readonly Pick<DailyTask, 'date' | 'status' | 'isRestDay' | 'notOffered'>[],
  weekFirstDay: string,
  returnedOn: string
): number {
  const dates = closingTasks.map((t) => t.date).filter(isDate);
  const done = closingTasks.filter((t) => !t.isRestDay && !t.notOffered && t.status === 'completed' && isDate(t.date)).map((t) => t.date);
  const from = done.length > 0 ? done.reduce((a, b) => (b > a ? b : a)) : dates.length > 0 ? dates.reduce((a, b) => (b < a ? b : a)) : weekFirstDay;
  const days = Math.round(dayIndex(returnedOn) - dayIndex(from));
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** RULE-12, WU-35 (3): the return rule's entry for a break of `days`; null without a profile or a matching entry. */
export function returnRuleEntry(profile: RecoveryProfile | null | undefined, days: number): { length: BreakLength; restart: Restart } | null {
  const breaks = profile?.returnRule?.breaks;
  if (!Array.isArray(breaks)) return null;
  const any = breaks.find((entry) => entry?.length === 'any');
  if (any) return any;
  const length: BreakLength = days >= LONG_BREAK_DAYS ? '3+ weeks' : '1-2 weeks';
  return breaks.find((entry) => entry?.length === length) ?? null;
}

/**
 * What the week writer is told for the first week back (WU-25 (3), WU-29 (1)): the days away and the rule's note. Never
 * a target or a restart level (M3.4). `highLoad` (WU-35 (4)) adds the "at or below" sentence and the first-week-back line.
 */
export type FirstWeekBack = {
  awayDays: number;
  /** The rule's `firstWeekBack` note; null for a goal with no readable profile. */
  note: string | null;
  /** The entry the length picked, for the log only (the restart is M3.4's). */
  length: BreakLength | null;
} & GoalLoad;

/**
 * WU-35 (4): `highLoad`, the goal is high-load (`isHighLoadGoal`, or its profile has a `highLoad` kind): the writer's
 * "at or below" line and the first-week-back line act only then. `everyStep`, the goal is `isHighLoadGoal`, so every
 * step of it is high-load (ND-5). Worked out once per close (M1.5a review) so the two can't disagree.
 */
export interface GoalLoad {
  highLoad: boolean;
  everyStep: boolean;
}

export function goalLoad(goal: { rawGoal: string; clarifiedOutcome: string }, profile: RecoveryProfile | null | undefined): GoalLoad {
  const everyStep = isHighLoadGoal(goal);
  return { highLoad: everyStep || (Array.isArray(profile?.kinds) && profile.kinds.some((kind) => kind?.highLoad === true)), everyStep };
}

export function firstWeekBackFor(profile: RecoveryProfile | null | undefined, breakDays: number, load: GoalLoad): FirstWeekBack {
  const note = typeof profile?.returnRule?.firstWeekBack === 'string' && profile.returnRule.firstWeekBack.trim() ? profile.returnRule.firstWeekBack.trim() : null;
  return { awayDays: breakDays, note, length: returnRuleEntry(profile, breakDays)?.length ?? null, ...load };
}
