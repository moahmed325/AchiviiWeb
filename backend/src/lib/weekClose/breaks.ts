import type { DailyTask } from '@prisma/client';
import { TOTAL_WEEKS, type WeekTarget } from '../ai/roadmap.js';
import { isHighLoadGoal } from '../highLoad.js';
import { sameUnit } from '../research/statedTarget.js';
import { isWeekTarget } from '../safety/storedTargets.js';
import { harder } from '../safety/targetSteps.js';
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

/** M1.5b (WU-40 (2)): the line after "Keep going". `{n}` is written in by the close; `{date}` is filled by the app. */
export const KEEP_GOING_INSIGHT = 'Welcome back. Your plan picks up at week {n} and now ends on {date}.';

/** M1.5b (WU-40 (2)): the line after "Do my final week". `{date}` is filled by the app. */
export const FINAL_WEEK_INSIGHT = 'Welcome back. Your final week starts today and ends on {date}.';

/** WU-37 (3): the card shows only when at least this many days of the break don't fit in the room (a whole week). */
export const JUMP_FROM_OVERFLOW_DAYS = 7;

/** WU-37, WU-38: the two choices past the limit; the card offers one of them next to "Start a fresh plan". */
export type PastLimitChoice = 'keep_going' | 'final_week';

/**
 * M1.5b (RULE-15, WU-37, WU-38 (2)): what a break past the limit does once the person chooses, or null when no choice is
 * needed (not a break, an overflow under a whole week, or week 12 closing). `gap` and `room` (`28 - movedDays`, never
 * below 0) are `planWeekMove`'s; `closedWeek` is the week closing.
 * - `keep_going`: `days` is the largest `d <= room` with `gap - d` a multiple of 7, so a week starts on the first try's
 *   date; with none, the room (that week's passed days are then not offered). `weekBack` is the week holding that date.
 * - `final_week`, when `weekBack` would be past week 12: week 12 starts on the first try's date, every week before it
 *   from `closedWeek + 1` is jumped, and `days` is whatever that takes, past the limit if needed (the only case).
 */
export function pastLimitMove(
  gap: number,
  room: number,
  closedWeek: number,
  /** B-106: `fixedDateRoom`'s days, or null with no fixed date ahead. Only the final week reads it. */
  dateRoom: number | null = null
): { choice: PastLimitChoice; days: number; weekBack: number } | null {
  const space = Math.max(0, room);
  if (closedWeek + 1 > TOTAL_WEEKS || gap < BREAK_FROM_GAP_DAYS || gap - space < JUMP_FROM_OVERFLOW_DAYS) return null;
  const aligned = space - ((((space - gap) % 7) + 7) % 7);
  const days = aligned >= 0 ? aligned : space;
  const weekBack = closedWeek + 1 + Math.floor((gap - days) / 7);
  if (weekBack <= TOTAL_WEEKS) return { choice: 'keep_going', days, weekBack };
  // Week 12 starts on the first try's date: week `closedWeek + 1` would start `gap` days ago, week 12 that many weeks later.
  const needed = gap - 7 * (TOTAL_WEEKS - closedWeek - 1);
  // B-106 (Mo, choice c): with a fixed date ahead, week 12 moves only as far as the date allows, so it started earlier
  // and its passed days are not offered; it always keeps today (at most 6 days earlier), so the final week is never over.
  const final = dateRoom === null ? needed : Math.min(needed, Math.max(dateRoom, needed - 6));
  return { choice: 'final_week', days: final, weekBack: TOTAL_WEEKS };
}

/**
 * B-106: how many days the plan may still move before its end (day 90, the day before `targetDate`) would fall after
 * the goal's fixed date, never below 0. Null with no fixed date, or once the fixed date is before `today` (the person's
 * local date at the first try): a date that has passed holds nothing back.
 */
export function fixedDateRoom(targetDate: Date, fixedDate: Date | null | undefined, today: string): number | null {
  if (!fixedDate || !Number.isFinite(fixedDate.getTime()) || !isDate(today)) return null;
  const fixed = dayIndex(fixedDate.toISOString().slice(0, 10));
  if (fixed < dayIndex(today)) return null;
  const end = dayIndex(targetDate.toISOString().slice(0, 10)) - 1;
  return Number.isFinite(end) ? Math.max(0, Math.round(fixed - end)) : null;
}

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

/** WU-59 (1): how many weeks of targets each restart goes back. */
const RESTART_BACK: Record<Restart, number> = { 'last level': 0, 'back 1 week': 1, 'back 2 weeks': 2 };

/**
 * Weekly update M3.4 (RULE-16, WU-16, WU-20 (2), WU-59 (1)): the level the first week back restarts at. `restart` is the
 * rule's restart, `level` the target and `week` the week it was read from; `fellBack` names why week `n`'s target was
 * used instead (for the log), else null.
 */
export interface RestartLevel {
  restart: Restart;
  level: WeekTarget;
  week: number;
  fellBack: 'harder' | 'kind' | 'unit' | 'unreadable' | null;
}

/**
 * WU-59 (1): the stored target of week `max(1, n - back)` (`n` the closing week, also after "Keep going"; `back` from the
 * entry `returnRuleEntry` picks for `breakDays`; no profile or no matching entry is `last level`, RULE-12), as `weeks`
 * reads it (`safeGoalTargets`). On a light-test goal that is the target the week shows: a light week stores its next
 * check's target. Never harder than week `n`'s target: if it is, or its kind or unit differs, or it can't be read, week
 * `n`'s target is used. Null when week `n`'s target can't be read, or when `weekBack` (the week written) shows week 12's
 * target (WU-15, WU-47): week 12 itself, or a light week whose next check is week 12.
 */
export function restartLevel(
  profile: RecoveryProfile | null | undefined,
  breakDays: number,
  closingWeek: number,
  weeks: readonly { weekNumber: number; target: unknown; light: boolean }[],
  weekBack: number
): RestartLevel | null {
  const shows = weeks.find((week) => week.weekNumber >= weekBack && !week.light)?.weekNumber ?? TOTAL_WEEKS;
  if (weekBack >= TOTAL_WEEKS || shows >= TOTAL_WEEKS) return null;
  const restart = returnRuleEntry(profile, breakDays)?.restart ?? 'last level';
  const targetOf = (n: number) => {
    const target = weeks.find((week) => week.weekNumber === n)?.target;
    return isWeekTarget(target) ? target : null;
  };
  const last = targetOf(closingWeek);
  if (!last) return null;
  const week = Math.max(1, closingWeek - (RESTART_BACK[restart] ?? 0));
  const level = targetOf(week);
  const fellBack: RestartLevel['fellBack'] = !level
    ? 'unreadable'
    : level.kind !== last.kind
      ? 'kind'
      : level.kind === 'number' && last.kind === 'number' && !sameUnit(level.unit, last.unit)
        ? 'unit'
        : level.kind === 'number' && last.kind === 'number' && harder(level.value, last.value, last.direction)
          ? 'harder'
          : null;
  return fellBack || !level ? { restart, level: last, week: closingWeek, fellBack } : { restart, level, week, fellBack: null };
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
