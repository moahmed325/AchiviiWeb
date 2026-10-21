/**
 * Weekly update M3.1 (RULE-1, RULE-2, RULE-4, RULE-7, RULE-10, WU-11, WU-30 (5), WU-45): the update on the review path.
 * `planWeeklyUpdate` reads what the update needs (read only), runs the call (`ai/weeklyUpdate.ts`), keeps the accepted
 * targets safe and returns what the close saves; nothing is written here. With either switch off, for week 12 and on
 * a close that is a break it returns null and nothing runs (R-3, R-7). A rejected or failed update is the fallback:
 * targets as planned, no status, no coach's note, the neutral line. It never fails the close.
 */
import type { DailyTask, RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { askWeeklyUpdate, type UpdateCounts, type UpdateHistoryWeek, type UpdateKind, type UpdateStatus, type WeeklyUpdateInput } from '../ai/weeklyUpdate.js';
import { BIG_TEST_WEEKS, pathwayFor, statedTargetText, TOTAL_WEEKS, type LoweredTarget, type WeekTarget, type WeekTest } from '../ai/roadmap.js';
import { logSafetyHit } from '../ai/safetyScan.js';
import { parseStoredSteps } from '../carryForward.js';
import { weekCounts } from '../missedSignals.js';
import { lastWeekResult, readStoredRoadmap } from '../planV2.js';
import { evaluate, loadReconcileGoal } from '../reconcileCore.js';
import { weekHandoff, type HandoffTask } from '../recovery/handoff.js';
import { readRecoveryProfile } from '../recovery/profile.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';
import { nextSafeStep } from '../safety/targetSteps.js';
import { safeGoalTargets, safeStoredTargets, week12LineFor, withTargetText } from '../safety/storedTargets.js';
import { AUTO_CLOSE_INSIGHT, planWeekMove, weekScore, type ClosingGoal } from './close.js';
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
  /** The review row's insight: the update's sentence, week 12's line, or the neutral line. */
  insight: string;
  /** `guidanceForNextWeek`, told to the week writer as the coach's note; null on the fallback. */
  coachNote: string | null;
  weeks: UpdatedWeek[];
  /** Week 12's `Goal.roadmap.loweredTargets` entry to set, so `week12Line` keeps showing (WU-45 (3)). */
  week12: LoweredTarget | null;
  /** The weeks safety lowered now, for the `[Safety]` `lowered_on_update` lines. */
  lowered: Array<LoweredTarget & { metric: string; unit: string }>;
  reasons: string[];
}

/** WU-23: week 12's honest line when safety lowered it, worded as the app words `week12Line`. */
export function week12Sentence(line: { safe: string; goal: string | null }): string {
  return line.goal ? `Week 12 aims at ${line.safe}, a safe step. Your ${line.goal} goal is the next step.` : `Week 12 aims at ${line.safe}, a safe step.`;
}

/** RULE-1, WU-45 (1): both switches on, weeks 1 to 11, and not a break (M3.4 owns that). */
export function updateRuns(goal: ClosingGoal, weekNumber: number, now: Date, timezone?: string | null): boolean {
  if (!weeklyUpdateEnabled() || weekNumber < 1 || weekNumber >= TOTAL_WEEKS) return false;
  const move = planWeekMove(goal, weekNumber, now, timezone, goal.dailyTasks);
  return !(move && move.breakDays !== null);
}

const fallback = (reasons: string[]): PlannedUpdate => ({
  outcome: 'fallback',
  status: null,
  insight: AUTO_CLOSE_INSIGHT,
  coachNote: null,
  weeks: [],
  week12: null,
  lowered: [],
  reasons,
});

/** RULE-8's line for M3.2's eval: one per update. */
function logUpdate(goalId: string, weekNumber: number, update: PlannedUpdate): void {
  const reasons = update.reasons.length ? JSON.stringify(update.reasons) : 'none';
  console.log(`[WeeklyUpdate] goal ${goalId} week ${weekNumber} status ${update.status ?? 'none'} outcome ${update.outcome} lowered ${update.lowered.length} reasons ${reasons}`);
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
  context: { userId: string; reflection: string; now: Date; timezone?: string | null }
): Promise<PlannedUpdate | null> {
  if (!updateRuns(goal, weekNumber, context.now, context.timezone)) return null;
  let update: PlannedUpdate;
  try {
    update = await runUpdate(goal, weekNumber, context);
  } catch (err) {
    console.error('[WeeklyUpdate] The update failed; targets stay as planned:', err);
    update = fallback(['error']);
  }
  logUpdate(goal.id, weekNumber, update);
  return update;
}

const isTarget = (value: unknown): value is WeekTarget =>
  !!value && typeof value === 'object' && (((value as WeekTarget).kind === 'number' && typeof (value as { value?: unknown }).value === 'number') || (value as WeekTarget).kind === 'deliverable');
const testOf = (week: Pick<RoadmapWeek, 'test'>) => (week.test && typeof week.test === 'object' ? (week.test as unknown as WeekTest) : null);
const isLight = (week: Pick<RoadmapWeek, 'test'>) => testOf(week)?.light === true;

function sameTarget(a: WeekTarget, b: unknown): boolean {
  if (!isTarget(b) || a.kind !== b.kind) return false;
  if (a.kind === 'deliverable') return b.kind === 'deliverable' && a.description === b.description;
  return b.kind === 'number' && Math.abs(a.value - b.value) < 1e-9 && a.unit === b.unit && a.metric === b.metric;
}

/** A logged result in a usable shape (as the week writer reads it): a value and passed or not. */
function isLogged(testResult: unknown): boolean {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return false;
  const { value, passed } = testResult as Record<string, unknown>;
  return (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && typeof passed === 'boolean';
}

/** The result as a number in the target's unit, or null (no unit, or the same unit, counts). */
function resultNumber(testResult: unknown, target: WeekTarget): number | null {
  if (target.kind !== 'number' || !isLogged(testResult)) return null;
  const { value, unit } = testResult as Record<string, unknown>;
  if (typeof unit === 'string' && unit.trim() && unit.trim().toLowerCase() !== target.unit.trim().toLowerCase()) return null;
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

/** RULE-2, WU-30 (5): `weekCounts` from the day kinds and carry plan reconcile works out, read only. */
async function countsOf(goal: ClosingGoal, weekNumber: number, userId: string, now: Date, timezone?: string | null): Promise<UpdateCounts> {
  const tasks = goal.dailyTasks;
  try {
    const evaluation = evaluate(await loadReconcileGoal(userId), { id: userId, timezone }, now);
    if (evaluation.applies && evaluation.goal.id === goal.id) {
      const counts = weekCounts(weekNumber, { tasks: evaluation.goal.dailyTasks, days: evaluation.result.days, carry: evaluation.plan });
      const kindOf = new Map(evaluation.result.days.map((day) => [day.taskId, day.kind]));
      const skipped = tasks.filter(
        (task) => task.isKeySession && !task.isRestDay && !task.notOffered && (kindOf.get(task.id) === 'missed' || (kindOf.get(task.id) === 'done' && task.usedMinimumVersion === true))
      );
      return { ...counts, keySkippedNames: skipped.map((task) => `${task.dayOfWeek}: ${task.title}`) };
    }
  } catch (err) {
    console.warn('[WeeklyUpdate] Could not count the week as reconcile does; counting from the stored days:', err);
  }
  // Only when reconcile does not apply: the review's own count.
  const { sessions, completed } = weekScore(tasks);
  return { practiceDone: completed, practicePlanned: sessions, keyDone: 0, keySkipped: 0, keySkippedNames: [], doneByMinimum: 0, missed: 0, dropped: 0 };
}

function resultLine(week: RoadmapWeek, testDay: DailyTask | undefined): string {
  return isLogged(week.testResult) || testDay ? lastWeekResult(testDay, week.testResult, isLight(week)) : 'not logged';
}

/** The last 3 closed weeks before this one (jumped weeks had no practice), with their review rows. */
async function historyOf(goalId: string, rows: readonly RoadmapWeek[], weekNumber: number): Promise<UpdateHistoryWeek[]> {
  const weeks = rows.filter((week) => week.weekNumber < weekNumber && !week.jumped && isTarget(week.target)).slice(-3);
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

/**
 * WU-11: each in-order kind with steps still to do, from the finished week's handoff (the same one the week writer is
 * told as `whereTheyAre`). Only with `METHOD_RECOVERY_ENABLED` on and a readable profile.
 */
async function kindsOf(goal: ClosingGoal, weekNumber: number): Promise<UpdateKind[] | undefined> {
  if (!methodRecoveryEnabled()) return undefined;
  const profile = readRecoveryProfile(goal.roadmap);
  if (!profile) return undefined;
  let weekBefore: DailyTask[] = [];
  if (weekNumber > 1) {
    try {
      weekBefore = await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: weekNumber - 1 }, orderBy: { dayNumber: 'asc' } });
    } catch (err) {
      console.warn('[WeeklyUpdate] Could not read the week before for the handoff:', err);
    }
  }
  const parse = (task: DailyTask): HandoffTask => ({ ...task, steps: parseStoredSteps(task.detailedSteps) });
  const tasks = goal.dailyTasks.map(parse);
  const handoff = weekHandoff({ tasks, profile, previous: profile, weekBefore: weekBefore.map(parse) });
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
  context: { userId: string; reflection: string; now: Date; timezone?: string | null }
): Promise<PlannedUpdate> {
  const stored = readStoredRoadmap(goal);
  const safe = safeGoalTargets(goal);
  const rows = safe?.weeks ?? [];
  const thisWeek = rows.find((week) => week.weekNumber === weekNumber);
  const left = rows.filter((week) => week.weekNumber > weekNumber);
  if (!stored || !safe || !thisWeek || !isTarget(thisWeek.target) || left.length !== TOTAL_WEEKS - weekNumber || !left.every((week) => isTarget(week.target))) {
    return fallback(['unreadable_targets']);
  }
  const target = thisWeek.target as unknown as WeekTarget;
  const lightTestGoal = rows.some(isLight);
  const pathway = pathwayFor(goal.rawGoal, goal.clarifiedOutcome);
  const run10k = pathway?.id === 'run10k';
  const roadmap = goal.roadmap as { startingPoint?: { value?: unknown } } | null;
  const startValue = typeof roadmap?.startingPoint?.value === 'number' ? roadmap.startingPoint.value : null;
  const valueOf = (week: { target: unknown } | undefined) => (week && isTarget(week.target) && week.target.kind === 'number' ? week.target.value : null);

  // The climb's base, as `safeStoredTargets` reads the goal once this week is closed: this week's target, or on a
  // light-test goal the last big week up to this one (the starting point when none).
  const lastBig = [...BIG_TEST_WEEKS].filter((week) => week < TOTAL_WEEKS && week <= weekNumber).pop();
  const firstAsked = lightTestGoal ? left.find((week) => !isLight(week)) : left[0];
  const safeMax = lightTestGoal
    ? safeMaxOf(lastBig === undefined ? startValue : valueOf(rows.find((week) => week.weekNumber === lastBig)), target, firstAsked?.weekNumber ?? TOTAL_WEEKS, 4, run10k)
    : safeMaxOf(valueOf(thisWeek), target, weekNumber + 1, 1, run10k);

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
    counts: await countsOf(goal, weekNumber, context.userId, context.now, context.timezone),
    reflection: context.reflection,
    history: await historyOf(goal.id, goal.roadmapWeeks, weekNumber),
    weeksLeft: left.map((week) => ({ weekNumber: week.weekNumber, target: week.target as unknown as WeekTarget, light: isLight(week) })),
    safeMax,
  };
  const kinds = await kindsOf(goal, weekNumber);
  if (kinds) input.kinds = kinds;

  const answer = await askWeeklyUpdate(input);
  if (!answer.update) return fallback(answer.reasons);

  // RULE-10, WU-45 (3): the accepted targets through the same climb `safeGoalTargets` runs once this week is closed, so
  // a read never lowers what the update stored. Safety lowers, it does not reject.
  const accepted = new Map(answer.update.targets.map((item) => [item.weekNumber, item.target]));
  const tests = pathway?.weeklyTests;
  const postClose = rows.map((week) => {
    if (week.weekNumber === weekNumber) return { ...week, status: 'completed' };
    const next = accepted.get(week.weekNumber);
    return next && week.weekNumber > weekNumber && !sameTarget(next, week.target) ? withTargetText(week, next, tests).week : week;
  });
  const checked = safeStoredTargets({ weeks: postClose, startValue, finalTest: stored.finalTest, pathway });
  const lowered = checked.weeks
    .filter((week) => week.weekNumber > weekNumber)
    .flatMap((week) => {
      const model = valueOf(postClose.find((item) => item.weekNumber === week.weekNumber));
      const safeValue = valueOf(week);
      const t = week.target as unknown as WeekTarget;
      return model !== null && safeValue !== null && t.kind === 'number' && Math.abs(model - safeValue) > 1e-9
        ? [{ week: week.weekNumber, model, safe: safeValue, metric: t.metric, unit: t.unit }]
        : [];
    });

  const storedRow = (n: number) => goal.roadmapWeeks.find((week) => week.weekNumber === n);
  const weeks: UpdatedWeek[] = checked.weeks
    .filter((week) => week.weekNumber > weekNumber && !sameTarget(week.target as unknown as WeekTarget, storedRow(week.weekNumber)?.target))
    .map((week) => ({ weekNumber: week.weekNumber, target: week.target as unknown as WeekTarget, objective: week.objective, keyMilestone: week.keyMilestone, test: week.test }));

  // Week 12: lowered by this climb (the only case it is not the goal, WU-23), or already lowered on read and now stored.
  const final12 = checked.weeks.find((week) => week.weekNumber === TOTAL_WEEKS);
  const current12 = valueOf(left.find((week) => week.weekNumber === TOTAL_WEEKS));
  const loweredNow = lowered.some((item) => item.week === TOTAL_WEEKS);
  const prior = safe.lowered.find((item) => item.week === TOTAL_WEEKS);
  const final12Value = valueOf(final12);
  const changes12 = weeks.some((week) => week.weekNumber === TOTAL_WEEKS);
  const week12: LoweredTarget | null =
    final12Value !== null && current12 !== null && changes12 && (loweredNow || prior)
      ? { week: TOTAL_WEEKS, model: prior?.model ?? current12, safe: final12Value }
      : null;

  let insight = answer.update.messageToUser;
  if (loweredNow && week12 && final12) {
    const statedText = statedTargetText(goal.rawGoal, stored.answers ?? []);
    const line = week12LineFor([week12], final12.target as unknown as WeekTarget, statedText, startValue);
    if (line) insight = week12Sentence(line);
  }
  return {
    outcome: answer.outcome,
    status: answer.update.status,
    insight,
    coachNote: answer.update.guidanceForNextWeek || null,
    weeks,
    week12,
    lowered,
    reasons: answer.reasons,
  };
}

/**
 * The goal as the week writer reads it after the update: the weeks left with their new targets (RULE-9). `roadmap` is
 * left as loaded: `writeWeekAfter` may store it with a recovery profile outside the close's transaction, so week 12's
 * entry is only ever saved inside it.
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
