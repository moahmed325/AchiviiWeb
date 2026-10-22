/**
 * Weekly update M3.1 (RULE-1, RULE-2, RULE-4, RULE-7, RULE-10, WU-11, WU-30 (5), WU-45, WU-46): the update on the review
 * path. `planWeeklyUpdate` reads what the update needs (read only), runs the call (`ai/weeklyUpdate.ts`), keeps the
 * accepted targets safe and returns what the close saves; nothing is written here. With either switch off, for week 12
 * and before a choice past the limit it returns null and nothing runs (R-3, R-7). A rejected or failed update is the
 * fallback: targets as planned, no status, no coach's note, the neutral line; except that a rejected one keeps the holds
 * code can see (WU-48: an unlogged test, a kind a week behind), with its own line. It never fails the close.
 * M3.3a (RULE-1, RULE-5, RULE-6, WU-52 to WU-56): the automatic close runs it too (`updateThenWrite`, both paths); the
 * model call has a time limit; code decides the re-test the new week starts with.
 * M3.4 (RULE-16, WU-16, WU-18, WU-59): a break runs it too, once the person has made any choice past the limit. Next week
 * is `WeekMove.weekBack`; the weeks a "Keep going" jumps are read as closed and never stored; next week restarts at the
 * return rule's level (`restartLevel`), kept by a fallback too; no status is stored; the re-test gains reason `break`.
 */
import type { DailyTask, RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import {
  askWeeklyUpdate,
  fallbackHold,
  heldWeekOf,
  fallbackRestart,
  nextWeekIsLast,
  type FallbackHold,
  type UpdateCounts,
  type UpdateHistoryWeek,
  type UpdateKind,
  type UpdateStatus,
  type WeeklyUpdateAnswer,
  type WeeklyUpdateInput,
} from '../ai/weeklyUpdate.js';
import { codeMadeRetestStep, retestDayOf, type Retest } from '../ai/retestStep.js';
import { weekLayout, type WeekDayPlan } from '../ai/weekPlan.js';
import type { WeekTest } from '../ai/roadmap.js';
import { restartLevel, type PastLimitChoice } from './breaks.js';
import type { Restart } from '../recovery/profile.js';
import { BIG_TEST_WEEKS, formatAmount, pathwayFor, statedTargetText, TOTAL_WEEKS, type LoweredTarget, type WeekTarget } from '../ai/roadmap.js';
import { logSafetyHit } from '../ai/safetyScan.js';
import { parseStoredSteps } from '../carryForward.js';
import { weekCounts } from '../missedSignals.js';
import { lastWeekResult, readRoutine, readStoredRoadmap, weekStartFor } from '../planV2.js';
import { evaluate, loadReconcileGoal } from '../reconcileCore.js';
import { weekHandoff, type HandoffTask } from '../recovery/handoff.js';
import { readRecoveryProfile } from '../recovery/profile.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';
import { sameUnit } from '../research/statedTarget.js';
import { nextSafeStep } from '../safety/targetSteps.js';
import { isWeekTarget, safeGoalTargets, safeStoredTargets, testOf, week12LineFor, withTargetText } from '../safety/storedTargets.js';
import { AUTO_CLOSE_INSIGHT, autoCloseInsight, jumpedWeeks, planWeekMove, weekScore, writeWeekAfter, type ClosingGoal, type WeekMove } from './close.js';
import { weeklyUpdateEnabled } from './switch.js';

/** A week left whose stored target the update changes, with the code-written text that follows it. */
export interface UpdatedWeek {
  weekNumber: number;
  target: WeekTarget;
  objective: string;
  keyMilestone: string;
  test: unknown;
}

export interface PlannedUpdate {
  outcome: 'accepted' | 'retry_accepted' | 'fallback';
  /** Stored as the closing week's `updateStatus`; null on the fallback (WU-45 (7)). */
  status: UpdateStatus | null;
  /** The review row's insight: the update's sentence, week 12's or next week's safe-step line, or the neutral line. */
  insight: string;
  /** `guidanceForNextWeek`, told to the week writer as the coach's note; null on the fallback. */
  coachNote: string | null;
  /** The holds code can see that were in force (RULE-5, WU-11); on a fallback, the ones it kept (WU-48). */
  held: FallbackHold[];
  weeks: UpdatedWeek[];
  /** Week 12's `Goal.roadmap.loweredTargets` entry to set, so `week12Line` keeps showing (WU-45 (3)). */
  week12: LoweredTarget | null;
  /** `Goal.roadmap.finalTest` rebuilt from a pathway's week 12 test when the update lowered week 12; else null. */
  finalTest: string | null;
  /** The weeks safety lowered now, for the `[Safety]` `lowered_on_update` lines. */
  lowered: Array<LoweredTarget & { metric: string; unit: string }>;
  /** The weeks the read-back stores although the model left them as read (in `weeks` too), for the log line. */
  readBack: number[];
  /** The week before, when the update read it (method switch on), so `writeWeekAfter` does not read it again. */
  weekBefore: DailyTask[] | null;
  reasons: string[];
  /** M3.3a (RULE-5, RULE-6, WU-56): the closing week's test the new week starts with, and why; null for none. */
  retest: (Retest & { by: RetestReason[] }) | null;
  /** M3.4 (WU-59 (1)): the restart a break's update used, for the log; null on any other close or without one. */
  restart: Restart | null;
}

export type RetestReason = 'break' | 'not_logged' | 'two_hard_weeks';

/** WU-52: the update's model call (both attempts together) on both paths; the reads before it are not counted. */
export const WEEKLY_UPDATE_TIME_LIMIT_MS = 15000;

class UpdateTimeLimit extends Error {}

/** `work`, or `UpdateTimeLimit` after `ms`. The call left running is never awaited again: it changes nothing. */
async function withinTimeLimit<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpdateTimeLimit()), ms);
  });
  work.catch(() => undefined);
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** WU-23: week 12's honest line when safety lowered it, worded as the app words `week12Line`. */
export function week12Sentence(line: { safe: string; goal: string | null }): string {
  return line.goal ? `Week 12 aims at ${line.safe}, a safe step. Your ${line.goal} goal is the next step.` : `Week 12 aims at ${line.safe}, a safe step.`;
}

/** WU-46 (3): next week's line when safety lowered next week and not week 12; the amount with no metric label. */
export function nextWeekSentence(target: WeekTarget): string {
  return `Next week aims at ${shownAmount(target)}, a safe step.`;
}

/** The amount with no metric label, " or less" for a lower-is-better target; a deliverable's text. */
function shownAmount(target: WeekTarget): string {
  return target.kind === 'number' ? `${formatAmount(target.value, target.unit)}${target.direction === 'lower_is_better' ? ' or less' : ''}` : target.description;
}

/** WU-48: a fallback that kept a hold (M4.1 rewords it). */
export const FALLBACK_HOLD_INSIGHT = "Next week keeps this week's target.";

/**
 * M3.4 (WU-59 (6)): a fallback after a break that set next week to the restart level (M4.1 rewords it). On a light-test
 * goal whose next week is a light week, "Week {w} picks up at {level}." names the big week (review fix 2).
 */
export const RESTART_FALLBACK_INSIGHT = 'Next week picks up at {level}.';
export const RESTART_FALLBACK_BIG_WEEK_INSIGHT = 'Week {w} picks up at {level}.';

/**
 * RULE-1, WU-45 (1): both switches on and weeks 1 to 11. M3.4: a break too, but never before the choice a break past the
 * limit needs (`choice`, the close's): that close is refused with 409 `choice_needed` before any model call.
 */
export function updateRuns(goal: ClosingGoal, weekNumber: number, now: Date, timezone?: string | null, choice?: PastLimitChoice | null): boolean {
  if (!weeklyUpdateEnabled() || weekNumber < 1 || weekNumber >= TOTAL_WEEKS) return false;
  return runsWith(planWeekMove(goal, weekNumber, now, timezone, goal.dailyTasks, choice));
}

/** `updateRuns` once the switches and week are checked: never before a choice a break past the limit needs. */
const runsWith = (move: WeekMove | null) => !(move?.choiceNeeded && !move.choice);

/**
 * M3.4 review fix 5: the close's move, worked out once, and the goal as the update reads it: the weeks a "Keep going"
 * jumps read as they will be stored (closed and jumped). `runUpdate` and `retestOf` both read it.
 */
interface ClosingRead {
  move: WeekMove | null;
  nextWeek: number;
  jumped: Set<number>;
  readGoal: ClosingGoal;
}

const asClosed = <W extends RoadmapWeek>(week: W, jumped: Set<number>): W => (jumped.has(week.weekNumber) ? { ...week, status: 'completed', jumped: true } : week);

function closingRead(goal: ClosingGoal, weekNumber: number, context: { now: Date; timezone?: string | null; choice?: PastLimitChoice | null }): ClosingRead {
  const move = planWeekMove(goal, weekNumber, context.now, context.timezone, goal.dailyTasks, context.choice);
  const jumped = new Set(jumpedWeeks(weekNumber, move));
  const readGoal = jumped.size > 0 ? { ...goal, roadmapWeeks: goal.roadmapWeeks.map((week) => asClosed(week, jumped)) } : goal;
  return { move, nextWeek: move?.weekBack ?? weekNumber + 1, jumped, readGoal };
}

const fallback = (reasons: string[], weekBefore: DailyTask[] | null = null): PlannedUpdate => ({
  outcome: 'fallback',
  status: null,
  insight: AUTO_CLOSE_INSIGHT,
  coachNote: null,
  held: [],
  weeks: [],
  week12: null,
  finalTest: null,
  lowered: [],
  readBack: [],
  weekBefore,
  reasons,
  retest: null,
  restart: null,
});

/** RULE-8's line for M3.2's eval: one per update. */
function logUpdate(goalId: string, weekNumber: number, update: PlannedUpdate): void {
  const reasons = update.reasons.length ? JSON.stringify(update.reasons) : 'none';
  const list = (weeks: number[]) => (weeks.length ? weeks.join(',') : 'none');
  const stored = list(update.weeks.map((week) => week.weekNumber));
  console.log(
    `[WeeklyUpdate] goal ${goalId} week ${weekNumber} status ${update.status ?? 'none'} restart ${update.restart ?? 'none'} outcome ${update.outcome} held ${update.held.join(',') || 'none'} lowered ${update.lowered.length} stored ${stored} readBack ${list(update.readBack)} retest ${update.retest?.by.join(',') || 'none'} reasons ${reasons}`
  );
}

/** RULE-10, WU-45 (3): one `[Safety]` line per week the update's targets were lowered on; after the close is saved. */
export function logUpdateLowered(goalId: string, update: PlannedUpdate | null): void {
  for (const item of update?.lowered ?? []) {
    logSafetyHit({
      goalId,
      week: item.week,
      rule: 'target_step',
      step: `Week ${item.week} target`,
      matched: `${item.metric}: ${item.model} ${item.unit} lowered to ${item.safe} ${item.unit}`,
      model: item.model,
      safe: item.safe,
      outcome: 'lowered_on_update',
    });
  }
}

export async function planWeeklyUpdate(
  goal: ClosingGoal,
  weekNumber: number,
  context: { userId: string; reflection: string; now: Date; timezone?: string | null; choice?: PastLimitChoice | null }
): Promise<PlannedUpdate | null> {
  if (!weeklyUpdateEnabled() || weekNumber < 1 || weekNumber >= TOTAL_WEEKS) return null;
  const read = closingRead(goal, weekNumber, context);
  if (!runsWith(read.move)) return null;
  let update: PlannedUpdate;
  try {
    update = await runUpdate(goal, weekNumber, context, read);
  } catch (err) {
    console.error('[WeeklyUpdate] The update failed; targets stay as planned:', err);
    update = fallback(['error']);
  }
  try {
    update.retest = retestOf(goal, weekNumber, update, read);
  } catch (err) {
    console.error('[WeeklyUpdate] Could not decide the re-test; none this week:', err);
  }
  logUpdate(goal.id, weekNumber, update);
  return update;
}

/**
 * RULE-5, RULE-6, WU-53, WU-54, WU-56 (M3.3a): whether the new week starts with a re-test of the closing week's test,
 * from these only. Unlogged: the closing week's measured test was not logged. Two hard weeks: this update's status is
 * `far_behind` and so is the stored status of the week before (no stored status is not `far_behind`; a fallback has
 * none). Neither after a light week, when next week shows week 12's target (WU-15, WU-47), or when the new week has no
 * offered practice day before its test day (the layout is code's, so it is known before the week is written).
 * M3.4 (WU-59 (4)): a break adds reason `break` (with `not_logged` too when the test was not logged): still one re-test of
 * the closing week's measured test, on the first week back (`weekBack`, its layout and dates). A break's update stores no
 * status, so two hard weeks never come from it (WU-18). On a high-load goal `writeWeekAfter` asks for the easy re-test.
 */
function retestOf(goal: ClosingGoal, weekNumber: number, update: PlannedUpdate, read: ClosingRead): PlannedUpdate['retest'] {
  const { move, nextWeek, readGoal } = read;
  const rows = safeGoalTargets(readGoal)?.weeks ?? readGoal.roadmapWeeks;
  const thisWeek = rows.find((week) => week.weekNumber === weekNumber);
  const test = thisWeek ? (testOf(thisWeek) as WeekTest | null) : null;
  if (!thisWeek || !test || typeof test.instructions !== 'string' || !test.instructions.trim() || isLight(thisWeek)) return null;
  const weeksLeft = rows.filter((week) => week.weekNumber >= nextWeek).map((week) => ({ weekNumber: week.weekNumber, target: week.target as unknown as WeekTarget, light: isLight(week) }));
  if (nextWeekIsLast({ weekNumber, weeksLeft, nextWeek })) return null;
  const before = goal.roadmapWeeks.find((week) => week.weekNumber === weekNumber - 1);
  const by: RetestReason[] = [
    ...(move && move.breakDays !== null ? ['break' as const] : []),
    ...(isLogged(thisWeek.testResult) ? [] : ['not_logged' as const]),
    ...(update.status === 'far_behind' && before && !before.jumped && before.updateStatus === 'far_behind' ? ['two_hard_weeks' as const] : []),
  ];
  if (by.length === 0) return null;
  const start = move && move.days > 0 ? move.startDate : goal.startDate;
  const layout = weekLayout(readRoutine(goal).planVariant, weekStartFor(start, nextWeek));
  if (retestDayOf(layout, move?.writtenOn) === null) return null;
  return { ofWeek: weekNumber, test, by };
}

const isLight = (week: Pick<RoadmapWeek, 'test'>) => testOf(week)?.light === true;

function sameTarget(a: WeekTarget, b: unknown): boolean {
  if (!isWeekTarget(b) || a.kind !== b.kind) return false;
  if (a.kind === 'deliverable') return b.kind === 'deliverable' && a.description === b.description;
  return b.kind === 'number' && Math.abs(a.value - b.value) < 1e-9 && a.unit === b.unit && a.metric === b.metric;
}

/** A logged result in a usable shape (as the week writer reads it): a value and passed or not. */
export function isLogged(testResult: unknown): boolean {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return false;
  const { value, passed } = testResult as Record<string, unknown>;
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && typeof passed === 'boolean';
}

/** The result as a number in the target's unit, or null (no unit, or the same unit, counts). */
export function resultNumber(testResult: unknown, target: WeekTarget): number | null {
  if (target.kind !== 'number' || !isLogged(testResult)) return null;
  const { value, unit } = testResult as Record<string, unknown>;
  if (typeof unit === 'string' && unit.trim() && !sameUnit(unit, target.unit)) return null;
  const number = typeof value === 'number' ? value : /^\s*\d+(?:\.\d+)?\s*$/.test(String(value)) ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

/** RULE-4, WU-43 (2): the last usable result of a measured week up to this one (a light test is not a result). */
function lowerBoundOf(rows: readonly RoadmapWeek[], weekNumber: number, target: WeekTarget): number | null {
  for (const week of [...rows].reverse()) {
    if (week.weekNumber > weekNumber || week.jumped || isLight(week)) continue;
    const number = resultNumber(week.testResult, target);
    if (number !== null) return number;
  }
  return null;
}

/**
 * RULE-2, WU-30 (5): `weekCounts` from the day kinds and carry plan reconcile works out, read only. When reconcile does
 * not apply or fails, only the review's own sessions count is sent and the rest is "not counted".
 */
async function countsOf(goal: ClosingGoal, weekNumber: number, userId: string, now: Date, timezone?: string | null): Promise<UpdateCounts> {
  const tasks = goal.dailyTasks;
  try {
    const evaluation = evaluate(await loadReconcileGoal(userId), { id: userId, timezone }, now);
    if (evaluation.applies && evaluation.goal.id === goal.id) {
      const { practiceDone, practicePlanned, keyDone, keySkipped, doneByMinimum, missed, dropped } = weekCounts(weekNumber, {
        tasks: evaluation.goal.dailyTasks,
        days: evaluation.result.days,
        carry: evaluation.plan,
      });
      const kindOf = new Map(evaluation.result.days.map((day) => [day.taskId, day.kind]));
      const skipped = tasks.filter(
        (task) => task.isKeySession && !task.isRestDay && !task.notOffered && (kindOf.get(task.id) === 'missed' || (kindOf.get(task.id) === 'done' && task.usedMinimumVersion === true))
      );
      return {
        practiceDone,
        practicePlanned,
        detail: { keyDone, keySkipped, keySkippedNames: skipped.map((task) => `${task.dayOfWeek}: ${task.title}`), doneByMinimum, missed, dropped },
      };
    }
  } catch (err) {
    console.warn('[WeeklyUpdate] Could not count the week as reconcile does; sending the sessions count only:', err);
  }
  const { sessions, completed } = weekScore(tasks);
  return { practiceDone: completed, practicePlanned: sessions, detail: null };
}

function resultLine(week: RoadmapWeek, testDay: DailyTask | undefined): string {
  return isLogged(week.testResult) || testDay ? lastWeekResult(testDay, week.testResult, isLight(week)) : 'not logged';
}

/**
 * The last 3 closed weeks before this one (jumped weeks had no practice), with their review rows. A re-tested week's
 * result is its re-test's late result (WU-17).
 */
async function historyOf(goalId: string, rows: readonly RoadmapWeek[], weekNumber: number): Promise<UpdateHistoryWeek[]> {
  const weeks = rows.filter((week) => week.weekNumber < weekNumber && !week.jumped && isWeekTarget(week.target)).slice(-3);
  if (weeks.length === 0) return [];
  const reviews = await prisma.weeklyReview.findMany({ where: { goalId, weekNumber: { in: weeks.map((week) => week.weekNumber) } } });
  return weeks.map((week) => {
    const review = reviews.find((row) => row.weekNumber === week.weekNumber);
    return {
      weekNumber: week.weekNumber,
      target: week.target as unknown as WeekTarget,
      light: isLight(week),
      result: isLogged(week.testResult) ? lastWeekResult(undefined, week.testResult, isLight(week)) : 'not logged',
      sessions: review ? `${review.tasksCompleted} of ${review.tasksPlanned}` : 'not recorded',
      status: week.updateStatus ?? null,
    };
  });
}

/** The week before, read as `writeWeekAfter` reads it (method switch on, week 2 on); never fails the update. */
async function weekBeforeOf(goal: ClosingGoal, weekNumber: number): Promise<DailyTask[] | null> {
  if (!methodRecoveryEnabled() || weekNumber <= 1) return null;
  try {
    return await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: weekNumber - 1 }, orderBy: { dayNumber: 'asc' } });
  } catch (err) {
    console.warn('[WeeklyUpdate] Could not read the week before for the handoff:', err);
    return [];
  }
}

/**
 * WU-11: each in-order kind with steps still to do, from the finished week's handoff (the same one the week writer is
 * told as `whereTheyAre`). Only with `METHOD_RECOVERY_ENABLED` on and a readable profile.
 */
function kindsOf(goal: ClosingGoal, weekBefore: DailyTask[] | null): UpdateKind[] | undefined {
  if (!methodRecoveryEnabled()) return undefined;
  const profile = readRecoveryProfile(goal.roadmap);
  if (!profile) return undefined;
  const parse = (task: DailyTask): HandoffTask => ({ ...task, steps: parseStoredSteps(task.detailedSteps) });
  const tasks = goal.dailyTasks.map(parse);
  const handoff = weekHandoff({ tasks, profile, previous: profile, weekBefore: (weekBefore ?? []).map(parse) });
  return handoff.carried
    .filter((kind) => kind.steps.length > 0)
    .map((kind) => {
      // As the in-order queue reads the week: the test day holds no in-order step (RULE-7).
      const sessions = tasks.filter((task) => !task.isRestDay && !task.isTestDay && task.steps.some((step) => step.kind === kind.kind)).length;
      const stepsBehind = kind.steps.length;
      return { name: kind.name.toLowerCase(), position: kind.steps[0].title, stepsBehind, sessions, weekBehind: stepsBehind >= sessions && stepsBehind >= 2 };
    });
}

/**
 * WU-45 (3): the most the first week the model sets may be. Each week is one safe step past the week before; on a
 * light-test goal the next big week is four safe steps past the base the climb starts from.
 */
function safeMaxOf(base: number | null, target: WeekTarget, weekNumber: number, steps: number, run10k: boolean): WeeklyUpdateInput['safeMax'] {
  if (base === null || target.kind !== 'number') return null;
  let value: number | null = base;
  for (let step = 0; step < steps && value !== null; step++) value = nextSafeStep(target, value, { run10k });
  return value === null ? null : { weekNumber, value };
}

async function runUpdate(
  goal: ClosingGoal,
  weekNumber: number,
  context: { userId: string; reflection: string; now: Date; timezone?: string | null; choice?: PastLimitChoice | null },
  read: ClosingRead
): Promise<PlannedUpdate> {
  const stored = readStoredRoadmap(goal);
  // M3.4 (WU-59 (7)): next week is the week this close writes; the weeks a "Keep going" jumps are read as they will be
  // stored (closed and jumped), so the weeks left are `nextWeek` to 12 and no jumped week is ever stored.
  const { move, nextWeek, jumped, readGoal } = read;
  const safe = safeGoalTargets(readGoal);
  const rows = safe?.weeks ?? [];
  const thisWeek = rows.find((week) => week.weekNumber === weekNumber);
  const left = rows.filter((week) => week.weekNumber >= nextWeek);
  if (
    !stored ||
    !safe ||
    !thisWeek ||
    !isWeekTarget(thisWeek.target) ||
    left.length !== TOTAL_WEEKS - nextWeek + 1 ||
    !left.every((week) => isWeekTarget(week.target))
  ) {
    return fallback(['unreadable_targets']);
  }
  const target = thisWeek.target as unknown as WeekTarget;
  const lightTestGoal = rows.some(isLight);
  const pathway = pathwayFor(goal.rawGoal, goal.clarifiedOutcome);
  const run10k = pathway?.id === 'run10k';
  const roadmap = goal.roadmap as { startingPoint?: { value?: unknown } } | null;
  const startValue = typeof roadmap?.startingPoint?.value === 'number' ? roadmap.startingPoint.value : null;
  const valueOf = (week: { target: unknown } | undefined) => (week && isWeekTarget(week.target) && week.target.kind === 'number' ? week.target.value : null);

  // The climb's base, as `safeStoredTargets` reads the goal once this week is closed: this week's target, or on a
  // light-test goal the last big week up to this one (the starting point when none). M3.4: every week before next week
  // is closed then (jumped weeks too), so the base is the week before next week, or the last big week before it.
  const lastBig = [...BIG_TEST_WEEKS].filter((week) => week < TOTAL_WEEKS && week < nextWeek).pop();
  const firstAsked = lightTestGoal ? left.find((week) => !isLight(week)) : left[0];
  const safeMax = lightTestGoal
    ? safeMaxOf(lastBig === undefined ? startValue : valueOf(rows.find((week) => week.weekNumber === lastBig)), target, firstAsked?.weekNumber ?? TOTAL_WEEKS, 4, run10k)
    : safeMaxOf(valueOf(rows.find((week) => week.weekNumber === nextWeek - 1)), target, nextWeek, 1, run10k);

  // Independent reads, side by side. The week before is read once, for the kinds here and for `writeWeekAfter`.
  const [counts, history, weekBefore] = await Promise.all([
    countsOf(goal, weekNumber, context.userId, context.now, context.timezone),
    historyOf(goal.id, goal.roadmapWeeks, weekNumber),
    weekBeforeOf(goal, weekNumber),
  ]);
  const testDay = goal.dailyTasks.find((task) => task.isTestDay);
  const input: WeeklyUpdateInput = {
    finalGoal: stored.finalGoal,
    method: stored.method,
    weekNumber,
    target,
    lightTest: isLight(thisWeek),
    lightTestGoal,
    result: resultLine(thisWeek, testDay),
    testLogged: isLogged(thisWeek.testResult),
    lowerBound: lowerBoundOf(goal.roadmapWeeks, weekNumber, target),
    counts,
    reflection: context.reflection,
    history,
    weeksLeft: left.map((week) => ({ weekNumber: week.weekNumber, target: week.target as unknown as WeekTarget, light: isLight(week) })),
    safeMax,
  };
  const kinds = kindsOf(goal, weekBefore);
  if (kinds) input.kinds = kinds;
  // A close that is not a break builds exactly the input it built before M3.4 (requirement 2).
  if (nextWeek !== weekNumber + 1) input.nextWeek = nextWeek;
  // M3.4 (RULE-16, WU-59 (1)): a break restarts next week at the return rule's level; none when next week shows week 12's
  // target. The profile is the goal's as loaded: none (an older goal gets one when the week is written) is `last level`.
  const level =
    move && move.breakDays !== null
      ? restartLevel(
          readRecoveryProfile(goal.roadmap),
          move.breakDays,
          weekNumber,
          rows.map((week) => ({ weekNumber: week.weekNumber, target: week.target, light: isLight(week) })),
          nextWeek
        )
      : null;
  if (move && move.breakDays !== null && level) {
    input.restart = { awayDays: move.breakDays, restart: level.restart, level: level.level, week: level.week, ...(level.fellBack ? { fellBack: true } : {}) };
    if (level.fellBack) {
      console.log(`[WeeklyUpdate] goal ${goal.id} week ${weekNumber} restart ${level.restart} uses week ${weekNumber}'s target (${level.fellBack})`);
    }
    // M3.4 review fix 1: the restart week must be the level exactly, so SAFETY names the first week the model sets after
    // it, one safe step above the level (on a light-test goal the next big week, four steps); none when that is week 12.
    const restartWeek = heldWeekOf(input);
    const after = left.find((week) => week.weekNumber > restartWeek && (!lightTestGoal || !isLight(week)));
    input.safeMax =
      after && after.weekNumber < TOTAL_WEEKS && level.level.kind === 'number'
        ? safeMaxOf(level.level.value, target, after.weekNumber, lightTestGoal ? 4 : 1, run10k)
        : null;
  }

  // WU-52: a time out, or an error from the model call, is the fallback below, with the holds code can see.
  let answer: WeeklyUpdateAnswer;
  try {
    answer = await withinTimeLimit(askWeeklyUpdate(input, { deadline: Date.now() + WEEKLY_UPDATE_TIME_LIMIT_MS }), WEEKLY_UPDATE_TIME_LIMIT_MS);
  } catch (err) {
    const timedOut = err instanceof UpdateTimeLimit;
    if (!timedOut) console.error("[WeeklyUpdate] The update call failed; code's holds still apply:", err);
    answer = { outcome: 'fallback', update: null, reasons: [timedOut ? 'time_limit' : 'error'] };
  }
  // WU-48: a fallback keeps the holds code can see (never far_behind), with its own line when next week keeps this
  // week's target; with no such hold it is the plain fallback. Its targets take the same path as accepted ones.
  const hold = fallbackHold(input);
  // M3.4 (WU-59 (3)): a fallback after a break keeps the restart, through the same path as an accepted update.
  const restartTargets = fallbackRestart(input);
  if (!answer.update && !hold.held.length && !restartTargets.length) return fallback(answer.reasons, weekBefore);
  const decided = answer.update ?? {
    status: null,
    targets: restartTargets.length ? restartTargets : hold.targets,
    messageToUser: restartTargets.length
      ? restartFallbackInsight(input)
      : hold.keeps
        ? FALLBACK_HOLD_INSIGHT
        : AUTO_CLOSE_INSIGHT,
    guidanceForNextWeek: '',
  };
  // M3.4 (WU-18, WU-53, WU-59 (2)): the week a break started in stores no status.
  const status = move && move.breakDays !== null ? null : decided.status;

  // RULE-10, WU-45 (3): the accepted targets through the same climb `safeGoalTargets` runs once this week is closed, so
  // a read never lowers what the update stored. Safety lowers, it does not reject.
  const accepted = new Map(decided.targets.map((item) => [item.weekNumber, item.target]));
  const tests = pathway?.weeklyTests;
  const postClose = rows.map((week) => {
    if (week.weekNumber === weekNumber) return { ...week, status: 'completed' };
    const next = accepted.get(week.weekNumber);
    return next && week.weekNumber >= nextWeek && !sameTarget(next, week.target) ? withTargetText(week, next, tests).week : week;
  });
  const checked = safeStoredTargets({ weeks: postClose, startValue, finalTest: stored.finalTest, pathway });
  const final = checked.weeks.filter((week) => week.weekNumber >= nextWeek);
  const lowered = final.flatMap((week) => {
    const model = valueOf(postClose.find((item) => item.weekNumber === week.weekNumber));
    const safeValue = valueOf(week);
    const t = week.target as unknown as WeekTarget;
    return model !== null && safeValue !== null && t.kind === 'number' && Math.abs(model - safeValue) > 1e-9
      ? [{ week: week.weekNumber, model, safe: safeValue, metric: t.metric, unit: t.unit }]
      : [];
  });

  // Fix 5: a week is stored when it differs from the week as read (`safeGoalTargets`), so a week only lowered on read
  // and left as it was stays as stored. Then the goal is read back as it would be saved; any week that would read
  // differently from what the update decided (an older goal whose stored, unlowered week now climbs from a changed week)
  // is stored too, so the read and the update agree.
  const asUpdated = (week: (typeof final)[number]): UpdatedWeek => ({
    weekNumber: week.weekNumber,
    target: week.target as unknown as WeekTarget,
    objective: week.objective,
    keyMilestone: week.keyMilestone,
    test: week.test,
  });
  const readRow = (n: number) => rows.find((week) => week.weekNumber === n);
  const toStore = new Map(final.filter((week) => !sameTarget(week.target as unknown as WeekTarget, readRow(week.weekNumber)?.target)).map((week) => [week.weekNumber, asUpdated(week)]));
  const readBack: number[] = [];
  for (let pass = 0; pass < 2; pass++) {
    const afterSave = goal.roadmapWeeks.map((week) => {
      if (week.weekNumber === weekNumber) return { ...week, status: 'completed' };
      if (jumped.has(week.weekNumber)) return asClosed(week, jumped);
      const next = toStore.get(week.weekNumber);
      return next ? { ...week, target: next.target as never, objective: next.objective, keyMilestone: next.keyMilestone, test: next.test as never } : week;
    });
    const reread = safeStoredTargets({ weeks: afterSave, startValue, finalTest: stored.finalTest, pathway });
    const differs = final.filter((week) => !toStore.has(week.weekNumber) && !sameTarget(week.target as unknown as WeekTarget, reread.weeks.find((item) => item.weekNumber === week.weekNumber)?.target));
    if (differs.length === 0) break;
    for (const week of differs) {
      toStore.set(week.weekNumber, asUpdated(week));
      readBack.push(week.weekNumber);
    }
  }
  const weeks = [...toStore.values()].sort((a, b) => a.weekNumber - b.weekNumber);

  // Week 12: its `loweredTargets` entry only when this update lowered it (the only case it is not the goal, WU-23), or
  // when the read-back above has to store a week 12 that was lowered on read, so `week12Line` keeps showing.
  const final12 = final.find((week) => week.weekNumber === TOTAL_WEEKS);
  const current12 = valueOf(left.find((week) => week.weekNumber === TOTAL_WEEKS));
  const loweredNow = lowered.some((item) => item.week === TOTAL_WEEKS);
  const prior = safe.lowered.find((item) => item.week === TOTAL_WEEKS);
  const final12Value = valueOf(final12);
  const stores12 = toStore.has(TOTAL_WEEKS);
  const week12: LoweredTarget | null =
    final12Value !== null && current12 !== null && stores12 && (loweredNow || prior)
      ? { week: TOTAL_WEEKS, model: prior?.model ?? current12, safe: final12Value }
      : null;
  // A pathway's week 12 test names its target, so `finalTest` follows whenever week 12 is stored: rebuilt by this
  // update's climb, else as the read rebuilt it (a week 12 lowered on read that the read-back stores).
  const rebuiltFinalTest = checked.finalTest !== stored.finalTest ? checked.finalTest : safe.finalTest;
  const finalTest = stores12 && rebuiltFinalTest !== stored.finalTest ? rebuiltFinalTest : null;

  let insight = decided.messageToUser;
  const nextLowered = final.find((week) => week.weekNumber === nextWeek);
  if (loweredNow && week12 && final12) {
    const statedText = statedTargetText(goal.rawGoal, stored.answers ?? []);
    const line = week12LineFor([week12], final12.target as unknown as WeekTarget, statedText, startValue);
    if (line) insight = week12Sentence(line);
  } else if (nextLowered && lowered.some((item) => item.week === nextWeek)) {
    // WU-46 (3): the model's sentence named a target code then lowered.
    insight = nextWeekSentence(nextLowered.target as unknown as WeekTarget);
  }
  return {
    outcome: answer.outcome,
    status,
    insight,
    coachNote: decided.guidanceForNextWeek || null,
    held: hold.held,
    weeks,
    week12,
    finalTest,
    lowered,
    readBack: readBack.sort((a, b) => a - b),
    weekBefore,
    reasons: answer.reasons,
    retest: null,
    restart: input.restart?.restart ?? null,
  };
}

/** M3.4: the restart fallback's line, the level as `nextWeekSentence` shows an amount (with no metric label). */
function restartFallbackInsight(input: WeeklyUpdateInput): string {
  const shown = shownAmount(input.restart!.level);
  // Review fix 2: on a light-test goal whose next week is light, the line names the big week the level is set on.
  if (input.lightTestGoal && input.weeksLeft[0]?.light) {
    return RESTART_FALLBACK_BIG_WEEK_INSIGHT.replace('{w}', String(heldWeekOf(input))).replace('{level}', shown);
  }
  return RESTART_FALLBACK_INSIGHT.replace('{level}', shown);
}

/**
 * The goal as the week writer reads it after the update: the weeks left with their new targets (RULE-9). `roadmap` is
 * left as loaded: `writeWeekAfter` may store it with a recovery profile outside the close's transaction, so week 12's
 * entry and `finalTest` are only ever saved inside it.
 */
export function withUpdatedTargets(goal: ClosingGoal, update: PlannedUpdate | null): ClosingGoal {
  if (!update || update.weeks.length === 0) return goal;
  const byWeek = new Map(update.weeks.map((week) => [week.weekNumber, week]));
  const roadmapWeeks = goal.roadmapWeeks.map((week) => {
    const next = byWeek.get(week.weekNumber);
    return next
      ? { ...week, target: next.target as never, objective: next.objective, keyMilestone: next.keyMilestone, test: next.test as never }
      : week;
  });
  return { ...goal, roadmapWeeks };
}

/**
 * M3.3a (RULE-1, WU-52): the update, then the week after from its targets, for the review and the automatic close alike.
 * With no update (a switch off, week 12, a break) the week is written exactly as before.
 */
export async function updateThenWrite(
  goal: ClosingGoal,
  weekNumber: number,
  context: { userId: string; reflection: string; now: Date; timezone?: string | null; choice?: PastLimitChoice | null }
): Promise<{ update: PlannedUpdate | null; next: Awaited<ReturnType<typeof writeWeekAfter>> }> {
  const update = await planWeeklyUpdate(goal, weekNumber, context);
  const next = await writeWeekAfter(withUpdatedTargets(goal, update), weekNumber, {
    now: context.now,
    timezone: context.timezone,
    ...(context.choice !== undefined ? { choice: context.choice } : {}),
    ...(update?.coachNote ? { coachNote: update.coachNote } : {}),
    ...(update?.weekBefore ? { weekBefore: update.weekBefore } : {}),
    ...(update?.retest ? { retest: { ofWeek: update.retest.ofWeek, test: update.retest.test } } : {}),
  });
  return { update, next };
}

/**
 * WU-56 (4): the automatic close's line. With an update, its sentence; after a short gap that moved the plan, the move
 * line, a space, then the sentence. Without one, as before. M3.4 (WU-59 (6)): after a break, its welcome-back line
 * (`WELCOME_BACK_INSIGHT`, `KEEP_GOING_INSIGHT` or `FINAL_WEEK_INSIGHT`), a space, then the sentence.
 */
export function autoCloseUpdateInsight(move: WeekMove | null, update: PlannedUpdate | null): string {
  // M3.3a review: the plain fallback's neutral line says nothing the move line doesn't; it is stored as before.
  if (!update || update.insight === AUTO_CLOSE_INSIGHT) return autoCloseInsight(move);
  return move && (move.days > 0 || move.breakDays !== null) ? `${autoCloseInsight(move)} ${update.insight}` : update.insight;
}

/**
 * Item 6: the new week's `retestOfWeek`, only when the week written holds the measured re-test. The easy re-test stores
 * nothing on the earlier week (M3.3a review, amends WU-56 (2)): a light result is not a result (WU-43).
 */
export function retestOfWeekFor(update: PlannedUpdate | null, written: readonly WeekDayPlan[] | null): number | null {
  if (!update?.retest || !written) return null;
  return written.some((day) => day.detailedSteps.some((step) => codeMadeRetestStep(step) === 'measured')) ? update.retest.ofWeek : null;
}
