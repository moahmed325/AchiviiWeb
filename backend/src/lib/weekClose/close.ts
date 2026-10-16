import { Prisma, type DailyTask, type Goal, type RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { TOTAL_WEEKS } from '../ai/roadmap.js';
import { slotTimeFor, type WeekDayPlan } from '../ai/weekPlan.js';
import { dayCloseInstant } from '../missedSessions.js';
import { getZonedDateString, normalizeTimezone } from '../timezone.js';
import { readRoutine, saveWeekTasks, weekStartFor, writeNextWeek } from '../planV2.js';
import { ensureRecoveryProfile } from '../recovery/store.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';

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

/** Practice days done out of practice days, as the review has always scored a week. */
export function weekScore(tasks: readonly DailyTask[]) {
  const practice = tasks.filter((t) => !t.isRestDay);
  const planned = practice.length || 1;
  const completed = practice.filter((t) => t.status === 'completed').length;
  return { sessions: practice.length, planned, completed, score: Math.round((completed / planned) * 100) };
}

/**
 * Writes the week after `weekNumber` exactly as the review always has: the goal's recovery profile (its own write, never
 * blocking), the week before with the method switch on, then `writeNextWeek`. `null` when the week could not be written;
 * `written: null` for week 12, which has no week after it.
 */
export async function writeWeekAfter(goal: ClosingGoal, weekNumber: number): Promise<{ written: WeekDayPlan[] | null } | null> {
  if (weekNumber + 1 > TOTAL_WEEKS) return { written: null };
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
  const written = await writeNextWeek(goal, weekNumber, goal.dailyTasks, slotTimeFor(readRoutine(goal).preferredSlot), recovery, weekBefore);
  return written ? { written } : null;
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
  now?: Date;
}

export interface SavedClose {
  review: Prisma.WeeklyReviewGetPayload<object> | null;
  nextTasks: DailyTask[];
}

/**
 * Saves a close all or nothing. Null when the closing week was no longer `active` (another close won): nothing is saved.
 * Week N closed, the review row, week N+1's tasks, week N+1 active and `currentWeek` commit together.
 */
export async function saveWeekClose(input: WeekCloseInput): Promise<SavedClose | null> {
  const { goal, weekNumber, by, written } = input;
  const { planned, completed, score } = weekScore(goal.dailyTasks);
  const reflection = input.reflection || '';
  const nextWeek = weekNumber + 1;
  const closedAt = input.now ?? new Date();

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

    const reviewFields = { tasksPlanned: planned, tasksCompleted: completed, scorePercentage: score, reflection, aiAdaptationInsight: input.insight ?? '' };
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
      nextTasks = await saveWeekTasks(goal.id, nextWeek, written, tx);
      await tx.roadmapWeek.update({ where: { goalId_weekNumber: { goalId: goal.id, weekNumber: nextWeek } }, data: { status: 'active' } });
      await tx.goal.update({ where: { id: goal.id }, data: { currentWeek: nextWeek } });
    }
    return { review, nextTasks };
  });
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
