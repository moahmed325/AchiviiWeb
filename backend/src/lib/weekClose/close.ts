import { Prisma, type DailyTask, type Goal, type RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { TOTAL_WEEKS } from '../ai/roadmap.js';
import { slotTimeFor, type WeekDayPlan } from '../ai/weekPlan.js';
import type { Retest } from '../ai/retestStep.js';
import { dayCloseInstant } from '../missedSessions.js';
import { getZonedDateString, normalizeTimezone } from '../timezone.js';
import { phaseGate, readRoutine, readStoredRoadmap, saveWeekTasks, weekStartFor, writeNextWeek } from '../planV2.js';
import { ensureRecoveryProfile } from '../recovery/store.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';
import { loadGoalFor } from '../safety/stepLoad.js';
import type { LoweredTarget, WeekTarget } from '../ai/roadmap.js';
import { weekCloseEnabled, weeklyUpdateEnabled } from './switch.js';
import type { PlannedUpdate } from './update.js';
import { answerLogLine, expireOpen, openCheckpoint, readCheckpoints } from './checkpoint.js';
import type { CloseCheckpoint } from './checkpointClose.js';
import {
  BREAK_FROM_GAP_DAYS,
  FINAL_WEEK_INSIGHT,
  KEEP_GOING_INSIGHT,
  WELCOME_BACK_INSIGHT,
  breakLength,
  firstWeekBackFor,
  goalLoad,
  fixedDateRoom,
  pastLimitMove,
  type PastLimitChoice,
} from './breaks.js';

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

/**
 * The automatic close's line (section 6): welcome back after a break (M1.5a, past the limit too), else the neutral
 * line, or the moved-plan line when the plan moved.
 */
export function autoCloseInsight(move: WeekMove | null): string {
  // M1.5b (WU-40 (2)): after the choice past the limit, the line names the week they pick up at.
  if (move?.choice === 'keep_going') return KEEP_GOING_INSIGHT.replace('{n}', String(move.weekBack));
  if (move?.choice === 'final_week') return FINAL_WEEK_INSIGHT;
  if (move && move.breakDays !== null) return WELCOME_BACK_INSIGHT;
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
 * - `days`: for a gap of 2 or more, `min(gap, 28 - movedDays)`, and never past the goal's fixed date (B-106,
 *   `fixedDateRoom`); else 0.
 * - `writtenOn`: the person's local date now. Every row of the new week dated before it is not offered.
 * - `breakDays` (M1.5a, RULE-13, WU-18): for a gap of 7 or more, the break's length (`breakLength`, from the closing
 *   week's last done step in `closingTasks` to the first try); else null. The move itself is the same either way.
 * - Past the limit (M1.5b, RULE-15, WU-37, WU-38): a break whose overflow is a whole week or more needs the person's
 *   choice. `choiceNeeded` names it; without that `choice` the close is refused before any model call. With it, `days`
 *   and `weekBack` are `pastLimitMove`'s, and the weeks after `closedWeek` before `weekBack` are jumped.
 */
export interface WeekMove {
  gap: number;
  days: number;
  startDate: Date;
  targetDate: Date;
  movedDays: number;
  writtenOn: string;
  breakDays: number | null;
  /** The week this close writes: `closedWeek + 1`, or the first week back after a jump (M1.5b). */
  weekBack: number;
  /** The choice this break needs (M1.5b); null when none is needed. */
  choiceNeeded: PastLimitChoice | null;
  /** The choice the move follows: `choiceNeeded` when the request gave it, else null. */
  choice: PastLimitChoice | null;
  /** B-106: the days the goal's fixed date still allowed (`fixedDateRoom`), or null with no fixed date ahead. */
  dateRoom: number | null;
}

/** M1.5b (WU-19, WU-40 (1)): the weeks a move jumps, first to last; empty for an ordinary close. */
/**
 * Checkpoints (RULE-9 review): thrown inside the close's transaction when the open offer was accepted after the close
 * loaded the goal, so nothing is saved; both close routes answer it with their 503 and the next try reads the new targets.
 */
export class CheckpointAcceptedError extends Error {
  constructor(goalId: string, weekNumber: number) {
    super(`[Checkpoint] goal ${goalId} week ${weekNumber} close not saved: the open offer was accepted during the close`);
    this.name = 'CheckpointAcceptedError';
  }
}

/**
 * Week 12's `loweredTargets` entry and a pathway's `finalTest` from the update, set on `roadmap` (changed in place and
 * returned): what the close stores, and the roadmap the checkpoint check reads before it does.
 */
export function withUpdateEntries(roadmap: Record<string, unknown>, update: PlannedUpdate | null | undefined): Record<string, unknown> {
  if (update?.week12) {
    const kept = Array.isArray(roadmap.loweredTargets) ? (roadmap.loweredTargets as LoweredTarget[]).filter((item) => item.week !== TOTAL_WEEKS) : [];
    roadmap.loweredTargets = [...kept, update.week12].sort((a, b) => a.week - b.week);
  }
  // M3.1 review (WU-46): a pathway's week 12 test names its target, so `finalTest` follows a lowered week 12.
  if (update?.finalTest) roadmap.finalTest = update.finalTest;
  return roadmap;
}

export function jumpedWeeks(closedWeek: number, move: Pick<WeekMove, 'weekBack'> | null | undefined): number[] {
  const weeks: number[] = [];
  for (let week = closedWeek + 1; move && week < move.weekBack; week++) weeks.push(week);
  return weeks;
}

export function planWeekMove(
  goal: Pick<Goal, 'startDate' | 'targetDate' | 'movedDays' | 'closeTriedAt' | 'closeTriedWeek'> & { fixedDate?: Date | null },
  closedWeek: number,
  now: Date,
  timezone?: string | null,
  closingTasks: readonly Pick<DailyTask, 'date' | 'status' | 'isRestDay' | 'notOffered'>[] = [],
  /** M1.5b: the person's choice past the limit; used only when it is the one this break needs. */
  choice?: PastLimitChoice | null
): WeekMove | null {
  if (!weekCloseEnabled() || closedWeek + 1 > TOTAL_WEEKS) return null;
  const firstTry = goal.closeTriedWeek === closedWeek && goal.closeTriedAt && goal.closeTriedAt.getTime() <= now.getTime() ? goal.closeTriedAt : now;
  const gap = gapDays(goal.startDate, closedWeek, firstTry, timezone);
  const moved = Math.max(0, goal.movedDays ?? 0);
  const tz = normalizeTimezone(timezone);
  // B-106: a fixed date ahead cuts the room, so the plan's end never moves past it.
  const dateRoom = fixedDateRoom(goal.targetDate, goal.fixedDate, getZonedDateString(firstTry, tz));
  const room = Math.max(0, Math.min(MOVE_LIMIT_DAYS - moved, dateRoom ?? Infinity));
  const past = pastLimitMove(gap, room, closedWeek, dateRoom);
  const chosen = past && choice === past.choice ? past : null;
  const days = chosen ? chosen.days : gap >= MOVE_FROM_GAP_DAYS ? Math.min(gap, room) : 0;
  const breakDays =
    gap >= BREAK_FROM_GAP_DAYS ? breakLength(closingTasks, weekStartFor(goal.startDate, closedWeek).toISOString().slice(0, 10), getZonedDateString(firstTry, tz)) : null;
  return {
    gap,
    days,
    startDate: shiftDays(goal.startDate, days),
    targetDate: shiftDays(goal.targetDate, days),
    movedDays: moved + days,
    writtenOn: getZonedDateString(now, tz),
    breakDays,
    weekBack: chosen ? chosen.weekBack : closedWeek + 1,
    choiceNeeded: past?.choice ?? null,
    choice: chosen?.choice ?? null,
    dateRoom,
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
  /**
   * `coachNote` (M3.1): the weekly update's guidance for the week writer, given only after an accepted update.
   * `weekBefore` (M3.1 review): the week before as the update already read it; when given it is not read again.
   * `retest` (M3.3a): the closing week's test to re-test, given only by the update; the days not offered are skipped.
   */
  context: { now?: Date; timezone?: string | null; choice?: PastLimitChoice | null; coachNote?: string; weekBefore?: DailyTask[]; retest?: Retest } = {}
): Promise<{ written: WeekDayPlan[] | null; move: WeekMove | null; choiceNeeded?: PastLimitChoice } | null> {
  if (weekNumber + 1 > TOTAL_WEEKS) return { written: null, move: null };
  const move = planWeekMove(goal, weekNumber, context.now ?? new Date(), context.timezone, goal.dailyTasks, context.choice);
  // M1.5b (WU-38 (1)): past the limit nothing is written until the person chooses; refused before any model call.
  if (move?.choiceNeeded && !move.choice) return { written: null, move, choiceNeeded: move.choiceNeeded };
  // M1.3a (RULE-1, MR-14): an older goal gets its recovery profile here; never blocks the close.
  const recovery = await ensureRecoveryProfile(goal);
  // M1.5a (WU-25 (3), WU-29, WU-35): after a break the week writer is told the days away and the return rule's note.
  const back = move && move.breakDays !== null ? firstWeekBackFor(recovery, move.breakDays, goalLoad(goal, recovery)) : null;
  if (back) console.log(`[WeekClose] goal ${goal.id} week ${weekNumber} break breakDays ${back.awayDays} rule ${back.length ?? 'none'} highLoad ${back.highLoad}`);
  // M3.1d review: with the method switch on, the week before too, so a break across the week change is seen. Never
  // fails the close: without it, the handoff only sees this week.
  let weekBefore: DailyTask[] = context.weekBefore ?? [];
  if (methodRecoveryEnabled() && weekNumber > 1 && !context.weekBefore) {
    try {
      weekBefore = await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: weekNumber - 1 }, orderBy: { dayNumber: 'asc' } });
    } catch (err) {
      console.warn('[GoalRouter] Could not read the week before for the handoff:', err);
    }
  }
  // Plan safety limits M2.2b (RULE-7, PSL-11 Q13, PSL-18 (3), (7)): a load goal's first week back is held to the newest
  // week with done running, so the weeks before this one are read (one query). Not caught: a failed read fails the close.
  const nextTarget = goal.roadmapWeeks.find((week) => week.weekNumber === (move?.weekBack ?? weekNumber + 1))?.target;
  const olderWeeks =
    back && nextTarget && loadGoalFor(goal, nextTarget as unknown as WeekTarget)
      ? await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: { lt: weekNumber } }, orderBy: [{ weekNumber: 'desc' }, { dayNumber: 'asc' }] })
      : null;
  // WU-26: the week is dated from the moved start, so it starts on the day they came back (or as near as the limit allows).
  const writerGoal = move && move.days > 0 ? { ...goal, startDate: move.startDate } : goal;
  // M3.4 review fix 6: whether the re-test is easy is only known here (`goalLoad` with the profile just ensured), so it
  // is logged here, after the update's `[WeeklyUpdate]` line.
  if (back?.highLoad && context.retest) console.log(`[WeeklyUpdate] goal ${goal.id} week ${weekNumber} retest easy`);
  const written = await writeNextWeek(
    writerGoal,
    weekNumber,
    goal.dailyTasks,
    slotTimeFor(readRoutine(goal).preferredSlot),
    recovery,
    weekBefore,
    // M1.5b: after a jump the week written is the first week back, not the week after this one.
    {
      ...(back ? { firstWeekBack: back } : {}),
      ...(move && move.weekBack !== weekNumber + 1 ? { weekNumber: move.weekBack } : {}),
      ...(olderWeeks ? { olderWeeks } : {}),
      ...(context.coachNote ? { coachNote: context.coachNote } : {}),
      // M3.4 (WU-41, WU-55, WU-59 (4)): a high-load first week back gets the easy re-test from the start.
      ...(context.retest
        ? { retest: { ...context.retest, ...(move ? { notOfferedBefore: move.writtenOn } : {}), ...(back?.highLoad ? { easy: true } : {}) } }
        : {}),
    }
  );
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
  /** B-3: the review cleared the entry, so a result logged earlier is deleted. */
  clearTestResult?: boolean;
  /** The review row's insight; the review row is not written when this is undefined (RULE-11: week 12 closed automatically). */
  insight?: string;
  /** From `writeWeekAfter`: the move and the days not offered, saved only by the request that wins. */
  move?: WeekMove | null;
  now?: Date;
  /** Weekly update M3.1 (RULE-9): saved only by the request that wins; missing means the review as before. */
  update?: PlannedUpdate | null;
  /** M3.3a (item 6): the week the new week re-tests (`retestOfWeekFor`); not written when missing or null. */
  retestOfWeek?: number | null;
  /** Checkpoints (RULE-2): from `checkpointsAtClose`; an offer is stored and every line logged only by the close that wins. */
  checkpoints?: CloseCheckpoint[];
}

export interface SavedClose {
  review: Prisma.WeeklyReviewGetPayload<object> | null;
  nextTasks: DailyTask[];
}

/**
 * Saves a close all or nothing. Null when the closing week was no longer `active` (another close won): nothing is saved.
 * Week N closed, the review row, week N+1's tasks (with the days not offered), week N+1 active (with `breakDays` after a
 * break), `currentWeek` and the move (`startDate`, `targetDate`, `movedDays`) commit together. Week N's stored rows don't change.
 * After a choice past the limit (M1.5b) the week written is `move.weekBack`, and the weeks jumped on the way close in
 * the same transaction.
 */
export async function saveWeekClose(input: WeekCloseInput): Promise<SavedClose | null> {
  const { goal, weekNumber, by, written, move } = input;
  const { planned, completed, score } = weekScore(goal.dailyTasks);
  const reflection = input.reflection || '';
  const nextWeek = move?.weekBack ?? weekNumber + 1;
  const jumped = jumpedWeeks(weekNumber, move);
  const closedAt = input.now ?? new Date();
  // Checkpoints (RULE-1, RULE-2, RULE-8): only with the weekly update. The roadmap is read for them only when the goal as
  // loaded has an open offer or this close makes one, so a goal with neither closes with exactly the reads it had. An
  // offer can only be opened by a close, so the loaded goal can't miss one; whether it is still open is read inside.
  const checkpointsOn = weeklyUpdateEnabled();
  const offers = checkpointsOn ? (input.checkpoints ?? []).flatMap((item) => (item.entry ? [item.entry] : [])) : [];
  const checkpointRead = checkpointsOn && (offers.length > 0 || openCheckpoint(readCheckpoints(goal.roadmap)) !== null);
  const logs: string[] = [];

  // About eight round trips after the model call; Prisma's default of 5 s is too tight for a slow database.
  const saved = await prisma.$transaction(async (tx) => {
    const won = await tx.roadmapWeek.updateMany({
      where: { goalId: goal.id, weekNumber, status: 'active' },
      data: {
        status: 'completed',
        executionScore: score,
        reviewNotes: reflection,
        closedBy: by,
        closedAt,
        // M4.1: a close without a result keeps the one logged earlier (PUT .../test-result).
        ...(input.testResult ? { testResult: input.testResult } : input.clearTestResult ? { testResult: Prisma.DbNull } : {}),
        // M3.1 (RULE-3, WU-45 (7)): the status stays inside; the fallback stores none.
        ...(input.update?.status ? { updateStatus: input.update.status } : {}),
      },
    });
    if (won.count === 0) return null;

    // M3.1 (RULE-9): the weeks left's new targets and week 12's lowered entry commit with the close, or not at all.
    for (const week of input.update?.weeks ?? []) {
      await tx.roadmapWeek.update({
        where: { goalId_weekNumber: { goalId: goal.id, weekNumber: week.weekNumber } },
        data: {
          target: week.target as unknown as Prisma.InputJsonObject,
          objective: week.objective,
          keyMilestone: week.keyMilestone,
          test: week.test as Prisma.InputJsonObject,
        },
      });
    }
    if (input.update?.week12 || input.update?.finalTest || checkpointRead) {
      // Read inside the transaction: the close may have written the recovery profile into the roadmap since the goal was
      // loaded, and an answer to the open offer may have been saved (it holds the open week's row, as this close does).
      const row = await tx.goal.findFirst({ where: { id: goal.id }, select: { roadmap: true } });
      const roadmap = { ...((row?.roadmap ?? {}) as Record<string, unknown>) };
      let changed = Boolean(input.update?.week12 || input.update?.finalTest);
      if (checkpointRead) {
        // RULE-9 review: an offer accepted after this close loaded the goal changed targets the update and the week
        // written did not see; saving would put the old targets back over the accepted ones. Nothing is saved.
        const loadedOpen = openCheckpoint(readCheckpoints(goal.roadmap));
        if (loadedOpen && readCheckpoints(roadmap).some((item) => item.week === loadedOpen.week && item.answer === 'accept')) {
          throw new CheckpointAcceptedError(goal.id, weekNumber);
        }
        // RULE-8: an offer still open is stored as keep, by expired, before this close's own offer.
        const { list, expired } = expireOpen(readCheckpoints(roadmap), closedAt);
        if (expired.length > 0 || offers.length > 0) {
          roadmap.checkpoints = [...list, ...offers];
          changed = true;
        }
        logs.push(...expired.map((item) => answerLogLine(goal.id, item)));
      }
      withUpdateEntries(roadmap, input.update);
      if (changed) await tx.goal.update({ where: { id: goal.id }, data: { roadmap: roadmap as unknown as Prisma.InputJsonObject } });
    }

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

    // M1.5b (WU-19, WU-40 (1)): each jumped week closes with no review row and no update. It has no tasks: a week is
    // written only when the week before it closes, so a jumped week never was.
    if (jumped.length > 0) {
      await tx.roadmapWeek.updateMany({
        where: { goalId: goal.id, weekNumber: { in: jumped } },
        data: { jumped: true, status: 'completed', closedBy: 'jumped', closedAt },
      });
    }

    let nextTasks: DailyTask[] = [];
    if (written && nextWeek <= TOTAL_WEEKS) {
      nextTasks = await saveWeekTasks(goal.id, nextWeek, written, tx, move ? { notOfferedBefore: move.writtenOn } : undefined);
      // M1.5a (WU-18): the break's length is stored on the first week back, by the request that wins only.
      const breakDays = move && move.breakDays !== null ? { breakDays: move.breakDays } : {};
      // M3.3a (RULE-5, RULE-6): the re-tested week. M3.4 (WU-59 (4)): after "Keep going" too, on the first week back.
      const retest = input.retestOfWeek ? { retestOfWeek: input.retestOfWeek } : {};
      await tx.roadmapWeek.update({ where: { goalId_weekNumber: { goalId: goal.id, weekNumber: nextWeek } }, data: { status: 'active', ...breakDays, ...retest } });
      const moved = move && move.days > 0 ? { startDate: move.startDate, targetDate: move.targetDate, movedDays: move.movedDays } : {};
      await tx.goal.update({ where: { id: goal.id }, data: { currentWeek: nextWeek, ...moved } });
    }
    return { review, nextTasks };
  }, { timeout: 15_000 });
  // RULE-13: the expired answers first, then this close's checkpoint lines; nothing for a close that lost.
  if (saved && checkpointsOn) {
    for (const line of [...logs, ...(input.checkpoints ?? []).map((item) => item.line)]) console.log(line);
  }
  return saved;
}

/**
 * The answer to a saved close, the review's shape (R-3): the same fields for a review and an automatic close, so the
 * two can't drift. `testResult` is what the review was sent, or the week's stored result for an automatic close.
 */
export function closeAnswer(goal: ClosingGoal, weekNumber: number, saved: SavedClose, testResult: unknown, move?: WeekMove | null) {
  const { score } = weekScore(goal.dailyTasks);
  const stored = readStoredRoadmap(goal);
  const gate = stored ? phaseGate(stored, weekNumber, score) : null;
  return {
    review: saved.review,
    // WU-33 (3): 0 for a week with no score, as its review row stores it; the row's `tasksPlanned` of 0 says not counted.
    scorePercentage: score ?? 0,
    nextWeekNumber: weekNumber + 1 <= TOTAL_WEEKS ? move?.weekBack ?? weekNumber + 1 : null,
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

/**
 * M1.5b: one line per close that followed a choice past the limit, and one more when the final week moved the plan
 * past the 28-day limit (WU-38 (2), the only case). Never fails a close that is already saved.
 */
export function logJump(goal: Pick<Goal, 'id'>, weekNumber: number, move: WeekMove | null | undefined): void {
  // B-106: one line when the fixed date held the move back.
  if (move && move.dateRoom !== null && move.days < move.gap && move.dateRoom < MOVE_LIMIT_DAYS) {
    console.log(`[WeekClose] goal ${goal.id} week ${weekNumber} fixedDate room ${move.dateRoom} moved ${move.days} gap ${move.gap}`);
  }
  if (!move?.choice) return;
  try {
    const jumped = jumpedWeeks(weekNumber, move);
    const range = jumped.length > 0 ? `${jumped[0]}-${jumped[jumped.length - 1]}` : 'none';
    console.log(`[WeekClose] goal ${goal.id} week ${weekNumber} jumped ${range} moved ${move.days} choice ${move.choice}`);
    if (move.movedDays > MOVE_LIMIT_DAYS) console.log(`[WeekClose] goal ${goal.id} week ${weekNumber} past the limit movedDays ${move.movedDays}`);
  } catch (err) {
    console.warn('[WeekClose] Could not log the jump:', err);
  }
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
