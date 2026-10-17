import { Prisma, type DailyTask, type Goal, type RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { TOTAL_WEEKS } from '../ai/roadmap.js';
import { slotTimeFor, type WeekDayPlan } from '../ai/weekPlan.js';
import { dayCloseInstant } from '../missedSessions.js';
import { getZonedDateString, normalizeTimezone } from '../timezone.js';
import { phaseGate, readRoutine, readStoredRoadmap, saveWeekTasks, weekStartFor, writeNextWeek } from '../planV2.js';
import { ensureRecoveryProfile } from '../recovery/store.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';
import { weekCloseEnabled } from './switch.js';

/**
 * Weekly update M1.2a (RULE-9, WU-27): the one way a week closes, by the weekly review or automatically. The week after
 * is written first (the model call, outside any transaction); then every write is saved in one transaction that starts
 * with a conditional update of the closing week from `active` to `completed`. That update decides who closes the week:
 * a request that loses it saves nothing.
 */

export type ClosedBy = 'review' | 'auto';

/** The goal as the close reads it: every roadmap week, and the closing week's tasks only. */
export type ClosingGoal = Goal & { roadmapWeeks: RoadmapWeek[]; dailyTasks: DailyTask[] };

/** RULE-18: the line an automatic close saves while targets stay as planned (02-feature.md section 6). */
export const AUTO_CLOSE_INSIGHT = 'Next week is ready. Your targets stay as planned.';

/**
 * Section 6, WU-33 (4): the line an automatic close saves when it moved the plan. `{date}` is stored as written; the app
 * fills in the plan's end in the viewer's locale.
 */
export const MOVED_INSIGHT = 'Your next week starts today. Your plan now ends on {date}.';

/**
 * M1.4 review fix 3: the line when the limit let the plan move only part of the gap (0 < days < gap), so the week did
 * not start today. `{date}` is stored as written, as above.
 */
export const PARTIAL_MOVE_INSIGHT = 'Your plan now ends on {date}.';

/** M1.4 review fix 2: a review of a week whose every practice day was not offered (no score). */
export const NOT_OFFERED_WEEK_INSIGHT = 'No practice days were offered this week.';

/** The automatic close's line (section 6): the neutral line, or the moved-plan line when the plan moved. */
export function autoCloseInsight(move: WeekMove | null): string {
  if (!move || move.days <= 0) return AUTO_CLOSE_INSIGHT;
  return move.days < move.gap ? PARTIAL_MOVE_INSIGHT : MOVED_INSIGHT;
}

/** The review's own line: "N of M sessions done.", or the not-offered line for a week with no score. */
export function reviewInsight(tasks: readonly DailyTask[]): string {
  const { sessions, completed, score } = weekScore(tasks);
  return score === null ? NOT_OFFERED_WEEK_INSIGHT : `${completed} of ${sessions} sessions done.`;
}

/** RULE-15 (WU-5): moved days never go above this for a plan. */
export const MOVE_LIMIT_DAYS = 28;

/** RULE-13 (WU-13): a gap of this many days or more moves the plan. */
export const MOVE_FROM_GAP_DAYS = 2;

/**
 * Practice days done out of practice days, as the review has always scored a week. WU-33 (3): days not offered are
 * left out. A week whose every practice day was not offered has no score (`score: null`, `planned: 0`); a week with
 * no practice day at all keeps the old count (planned 1, score 0), so nothing changes without days not offered.
 */
export function weekScore(tasks: readonly DailyTask[]) {
  const practice = tasks.filter((t) => !t.isRestDay);
  const offered = practice.filter((t) => !t.notOffered);
  const completed = offered.filter((t) => t.status === 'completed').length;
  if (offered.length === 0 && practice.length > 0) return { sessions: 0, planned: 0, completed, score: null };
  const planned = offered.length || 1;
  return { sessions: offered.length, planned, completed, score: Math.round((completed / planned) * 100) };
}

/**
 * RULE-13, RULE-14 (WU-13, WU-26, WU-33 (2)): how the close of `closedWeek` moves the plan. Null with
 * `WEEK_CLOSE_ENABLED` off (RULE-18: no gap, no move, no days not offered) and for week 12, which has no week after it.
 * - `gap`: days from the new week's planned start to the local date of the first open that tried to close this week
 *   (`closeTriedAt` when `closeTriedWeek` is this week, else `now`), so days spent on failed writes never count (RULE-9).
 * - `days`: for a gap of 2 or more, `min(gap, 28 - movedDays)`; else 0.
 * - `writtenOn`: the person's local date now. Every row of the new week dated before it is not offered.
 */
export interface WeekMove {
  gap: number;
  days: number;
  startDate: Date;
  targetDate: Date;
  movedDays: number;
  writtenOn: string;
}

export function planWeekMove(
  goal: Pick<Goal, 'startDate' | 'targetDate' | 'movedDays' | 'closeTriedAt' | 'closeTriedWeek'>,
  closedWeek: number,
  now: Date,
  timezone?: string | null
): WeekMove | null {
  if (!weekCloseEnabled() || closedWeek + 1 > TOTAL_WEEKS) return null;
  const firstTry = goal.closeTriedWeek === closedWeek && goal.closeTriedAt && goal.closeTriedAt.getTime() <= now.getTime() ? goal.closeTriedAt : now;
  const gap = gapDays(goal.startDate, closedWeek, firstTry, timezone);
  const moved = Math.max(0, goal.movedDays ?? 0);
  const days = gap >= MOVE_FROM_GAP_DAYS ? Math.max(0, Math.min(gap, MOVE_LIMIT_DAYS - moved)) : 0;
  return {
    gap,
    days,
    startDate: shiftDays(goal.startDate, days),
    targetDate: shiftDays(goal.targetDate, days),
    movedDays: moved + days,
    writtenOn: getZonedDateString(now, normalizeTimezone(timezone)),
  };
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

/**
 * Writes the week after `weekNumber` exactly as the review always has: the goal's recovery profile (its own write, never
 * blocking), the week before with the method switch on, then `writeNextWeek`. `null` when the week could not be written;
 * `written: null` for week 12, which has no week after it. With `WEEK_CLOSE_ENABLED` on, the move is worked out first
 * (`planWeekMove`) and the week is written from the moved start; nothing is saved here.
 */
export async function writeWeekAfter(
  goal: ClosingGoal,
  weekNumber: number,
  context: { now?: Date; timezone?: string | null } = {}
): Promise<{ written: WeekDayPlan[] | null; move: WeekMove | null } | null> {
  if (weekNumber + 1 > TOTAL_WEEKS) return { written: null, move: null };
  const move = planWeekMove(goal, weekNumber, context.now ?? new Date(), context.timezone);
  // M1.3a (RULE-1, MR-14): an older goal gets its recovery profile here; never blocks the close.
  const recovery = await ensureRecoveryProfile(goal);
  // M3.1d review: with the method switch on, the week before too, so a break across the week change is seen. Never
  // fails the close: without it, the handoff only sees this week.
  let weekBefore: DailyTask[] = [];
  if (methodRecoveryEnabled() && weekNumber > 1) {
    try {
      weekBefore = await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: weekNumber - 1 }, orderBy: { dayNumber: 'asc' } });
    } catch (err) {
      console.warn('[GoalRouter] Could not read the week before for the handoff:', err);
    }
  }
  // WU-26: the week is dated from the moved start, so it starts on the day they came back (or as near as the limit allows).
  const writerGoal = move && move.days > 0 ? { ...goal, startDate: move.startDate } : goal;
  const written = await writeNextWeek(writerGoal, weekNumber, goal.dailyTasks, slotTimeFor(readRoutine(goal).preferredSlot), recovery, weekBefore);
  return written ? { written, move } : null;
}

export interface WeekCloseInput {
  goal: ClosingGoal;
  weekNumber: number;
  by: ClosedBy;
  /** From `writeWeekAfter`; null for week 12. */
  written: WeekDayPlan[] | null;
  reflection?: string;
  /** A result sent with the review. Without one, a result logged earlier is kept (M4.1). */
  testResult?: Prisma.InputJsonObject | null;
  /** The review row's insight; the review row is not written when this is undefined (RULE-11: week 12 closed automatically). */
  insight?: string;
  /** From `writeWeekAfter`: the move and the days not offered, saved only by the request that wins. */
  move?: WeekMove | null;
  now?: Date;
}

export interface SavedClose {
  review: Prisma.WeeklyReviewGetPayload<object> | null;
  nextTasks: DailyTask[];
}

/**
 * Saves a close all or nothing. Null when the closing week was no longer `active` (another close won): nothing is saved.
 * Week N closed, the review row, week N+1's tasks (with the days not offered), week N+1 active, `currentWeek` and the
 * move (`startDate`, `targetDate`, `movedDays`) commit together. Week N's stored rows don't change.
 */
export async function saveWeekClose(input: WeekCloseInput): Promise<SavedClose | null> {
  const { goal, weekNumber, by, written, move } = input;
  const { planned, completed, score } = weekScore(goal.dailyTasks);
  const reflection = input.reflection || '';
  const nextWeek = weekNumber + 1;
  const closedAt = input.now ?? new Date();

  // About eight round trips after the model call; Prisma's default of 5 s is too tight for a slow database.
  return prisma.$transaction(async (tx) => {
    const won = await tx.roadmapWeek.updateMany({
      where: { goalId: goal.id, weekNumber, status: 'active' },
      data: {
        status: 'completed',
        executionScore: score,
        reviewNotes: reflection,
        closedBy: by,
        closedAt,
        // M4.1: a close without a result keeps the one logged earlier (PUT .../test-result).
        ...(input.testResult ? { testResult: input.testResult } : {}),
      },
    });
    if (won.count === 0) return null;

    // WU-33 (3): a week with no score stores 0 of 0 here, because these columns can't be empty.
    const reviewFields = { tasksPlanned: planned, tasksCompleted: completed, scorePercentage: score ?? 0, reflection, aiAdaptationInsight: input.insight ?? '' };
    const review =
      input.insight === undefined
        ? null
        : await tx.weeklyReview.upsert({
            where: { goalId_weekNumber: { goalId: goal.id, weekNumber } },
            update: reviewFields,
            create: { goalId: goal.id, weekNumber, ...reviewFields },
          });

    let nextTasks: DailyTask[] = [];
    if (written && nextWeek <= TOTAL_WEEKS) {
      nextTasks = await saveWeekTasks(goal.id, nextWeek, written, tx, move ? { notOfferedBefore: move.writtenOn } : undefined);
      await tx.roadmapWeek.update({ where: { goalId_weekNumber: { goalId: goal.id, weekNumber: nextWeek } }, data: { status: 'active' } });
      const moved = move && move.days > 0 ? { startDate: move.startDate, targetDate: move.targetDate, movedDays: move.movedDays } : {};
      await tx.goal.update({ where: { id: goal.id }, data: { currentWeek: nextWeek, ...moved } });
    }
    return { review, nextTasks };
  }, { timeout: 15_000 });
}

/**
 * The answer to a saved close, the review's shape (R-3): the same fields for a review and an automatic close, so the
 * two can't drift. `testResult` is what the review was sent, or the week's stored result for an automatic close.
 */
export function closeAnswer(goal: ClosingGoal, weekNumber: number, saved: SavedClose, testResult: unknown) {
  const { score } = weekScore(goal.dailyTasks);
  const stored = readStoredRoadmap(goal);
  const gate = stored ? phaseGate(stored, weekNumber, score) : null;
  return {
    review: saved.review,
    // WU-33 (3): 0 for a week with no score, as its review row stores it; the row's `tasksPlanned` of 0 says not counted.
    scorePercentage: score ?? 0,
    nextWeekNumber: weekNumber + 1 <= TOTAL_WEEKS ? weekNumber + 1 : null,
    nextWeekTasks: saved.nextTasks,
    isMilestoneCheckpoint: Boolean(gate),
    milestoneGateTransition: gate,
    testResult,
  };
}

/**
 * RULE-8, WU-30: the open week can close automatically once its last day's close (bedtime plus 2 hours, never after
 * 04:00, in the person's time zone) has passed. Only a week still `active` and still `currentWeek`.
 */
export function weekCloseDue(
  goal: Pick<Goal, 'currentWeek' | 'routine'> & { roadmapWeeks: Pick<RoadmapWeek, 'weekNumber' | 'status'>[] },
  weekTasks: readonly Pick<DailyTask, 'date'>[],
  now: Date,
  timezone?: string | null
): boolean {
  const week = goal.roadmapWeeks.find((w) => w.weekNumber === goal.currentWeek);
  if (week?.status !== 'active') return false;
  const dates = weekTasks.map((t) => t.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(`${d}T00:00:00Z`)));
  if (dates.length === 0) return false;
  const lastDay = dates.reduce((a, b) => (b > a ? b : a));
  return dayCloseInstant(lastDay, readRoutine(goal).sleepTime, timezone).getTime() <= now.getTime();
}

/** Days from the new week's planned start to `now` in the person's time zone; 0 when on time, early or unreadable. */
export function gapDays(goalStart: Date, closedWeek: number, now: Date, timezone?: string | null): number {
  const start = weekStartFor(goalStart, closedWeek + 1);
  if (isNaN(start.getTime())) return 0;
  // Relies on Goal.startDate being the local start date stored at UTC midnight (resolveGoalStart), as weekLayout reads
  // it too; this must change if that ever changes (M1.4 shifts startDate).
  const plannedStart = start.toISOString().slice(0, 10);
  const today = getZonedDateString(now, normalizeTimezone(timezone));
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${plannedStart}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** WU-30 (1): one line per close, for O1's production checks. Never fails a close that is already saved. */
export function logWeekClose(goal: Pick<Goal, 'id' | 'startDate'>, weekNumber: number, by: ClosedBy, now: Date, timezone: string | null | undefined, startedAt: number): void {
  try {
    const gap = gapDays(goal.startDate, weekNumber, now, timezone);
    console.log(`[WeekClose] goal ${goal.id} week ${weekNumber} by ${by} gapDays ${gap} ms ${Date.now() - startedAt}`);
  } catch (err) {
    console.warn('[WeekClose] Could not log the close:', err);
  }
}
