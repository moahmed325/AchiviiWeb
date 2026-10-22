/**
 * Weekly update M3.1 (RULE-1, RULE-2, RULE-4, RULE-7, RULE-10, WU-11, WU-30 (5), WU-45, WU-46): the update on the review
 * path. `planWeeklyUpdate` reads what the update needs (read only), runs the call (`ai/weeklyUpdate.ts`), keeps the
 * accepted targets safe and returns what the close saves; nothing is written here. With either switch off, for week 12
 * and on a close that is a break it returns null and nothing runs (R-3, R-7). A rejected or failed update is the
 * fallback: targets as planned, no status, no coach's note, the neutral line; except that a rejected one keeps the holds
 * code can see (WU-48: an unlogged test, a kind a week behind), with its own line. It never fails the close.
 */
import type { DailyTask, RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { askWeeklyUpdate, fallbackHold, type FallbackHold, type UpdateCounts, type UpdateHistoryWeek, type UpdateKind, type UpdateStatus, type WeeklyUpdateInput } from '../ai/weeklyUpdate.js';
import { BIG_TEST_WEEKS, formatAmount, pathwayFor, statedTargetText, TOTAL_WEEKS, type LoweredTarget, type WeekTarget } from '../ai/roadmap.js';
import { logSafetyHit } from '../ai/safetyScan.js';
import { parseStoredSteps } from '../carryForward.js';
import { weekCounts } from '../missedSignals.js';
import { lastWeekResult, readStoredRoadmap } from '../planV2.js';
import { evaluate, loadReconcileGoal } from '../reconcileCore.js';
import { weekHandoff, type HandoffTask } from '../recovery/handoff.js';
import { readRecoveryProfile } from '../recovery/profile.js';
import { methodRecoveryEnabled } from '../recovery/switch.js';
import { sameUnit } from '../research/statedTarget.js';
import { nextSafeStep } from '../safety/targetSteps.js';
import { isWeekTarget, safeGoalTargets, safeStoredTargets, testOf, week12LineFor, withTargetText } from '../safety/storedTargets.js';
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
}

/** WU-23: week 12's honest line when safety lowered it, worded as the app words `week12Line`. */
export function week12Sentence(line: { safe: string; goal: string | null }): string {
  return line.goal ? `Week 12 aims at ${line.safe}, a safe step. Your ${line.goal} goal is the next step.` : `Week 12 aims at ${line.safe}, a safe step.`;
}

/** WU-46 (3): next week's line when safety lowered next week and not week 12; the amount with no metric label. */
export function nextWeekSentence(target: WeekTarget): string {
  const shown = target.kind === 'number' ? `${formatAmount(target.value, target.unit)}${target.direction === 'lower_is_better' ? ' or less' : ''}` : target.description;
  return `Next week aims at ${shown}, a safe step.`;
}

/** WU-48: a fallback that kept a hold (M4.1 rewords it). */
export const FALLBACK_HOLD_INSIGHT = "Next week keeps this week's target.";

/** RULE-1, WU-45 (1): both switches on, weeks 1 to 11, and not a break (M3.4 owns that). */
export function updateRuns(goal: ClosingGoal, weekNumber: number, now: Date, timezone?: string | null): boolean {
  if (!weeklyUpdateEnabled() || weekNumber < 1 || weekNumber >= TOTAL_WEEKS) return false;
  const move = planWeekMove(goal, weekNumber, now, timezone, goal.dailyTasks);
  return !(move && move.breakDays !== null);
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
});

/** RULE-8's line for M3.2's eval: one per update. */
function logUpdate(goalId: string, weekNumber: number, update: PlannedUpdate): void {
  const reasons = update.reasons.length ? JSON.stringify(update.reasons) : 'none';
  const list = (weeks: number[]) => (weeks.length ? weeks.join(',') : 'none');
  const stored = list(update.weeks.map((week) => week.weekNumber));
  console.log(
    `[WeeklyUpdate] goal ${goalId} week ${weekNumber} status ${update.status ?? 'none'} outcome ${update.outcome} held ${update.held.join(',') || 'none'} lowered ${update.lowered.length} stored ${stored} readBack ${list(update.readBack)} reasons ${reasons}`
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

const isLight = (week: Pick<RoadmapWeek, 'test'>) => testOf(week)?.light === true;

function sameTarget(a: WeekTarget, b: unknown): boolean {
  if (!isWeekTarget(b) || a.kind !== b.kind) return false;
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

/** The last 3 closed weeks before this one (jumped weeks had no practice), with their review rows. */
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
  context: { userId: string; reflection: string; now: Date; timezone?: string | null }
): Promise<PlannedUpdate> {
  const stored = readStoredRoadmap(goal);
  const safe = safeGoalTargets(goal);
  const rows = safe?.weeks ?? [];
  const thisWeek = rows.find((week) => week.weekNumber === weekNumber);
  const left = rows.filter((week) => week.weekNumber > weekNumber);
  if (!stored || !safe || !thisWeek || !isWeekTarget(thisWeek.target) || left.length !== TOTAL_WEEKS - weekNumber || !left.every((week) => isWeekTarget(week.target))) {
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
  // light-test goal the last big week up to this one (the starting point when none).
  const lastBig = [...BIG_TEST_WEEKS].filter((week) => week < TOTAL_WEEKS && week <= weekNumber).pop();
  const firstAsked = lightTestGoal ? left.find((week) => !isLight(week)) : left[0];
  const safeMax = lightTestGoal
    ? safeMaxOf(lastBig === undefined ? startValue : valueOf(rows.find((week) => week.weekNumber === lastBig)), target, firstAsked?.weekNumber ?? TOTAL_WEEKS, 4, run10k)
    : safeMaxOf(valueOf(thisWeek), target, weekNumber + 1, 1, run10k);

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

  const answer = await askWeeklyUpdate(input);
  // WU-48: a fallback keeps the holds code can see (never far_behind), with its own line when next week keeps this
  // week's target; with no such hold it is the plain fallback. Its targets take the same path as accepted ones.
  const hold = fallbackHold(input);
  if (!answer.update && !hold.held.length) return fallback(answer.reasons, weekBefore);
  const decided = answer.update ?? {
    status: null,
    targets: hold.targets,
    messageToUser: hold.keeps ? FALLBACK_HOLD_INSIGHT : AUTO_CLOSE_INSIGHT,
    guidanceForNextWeek: '',
  };

  // RULE-10, WU-45 (3): the accepted targets through the same climb `safeGoalTargets` runs once this week is closed, so
  // a read never lowers what the update stored. Safety lowers, it does not reject.
  const accepted = new Map(decided.targets.map((item) => [item.weekNumber, item.target]));
  const tests = pathway?.weeklyTests;
  const postClose = rows.map((week) => {
    if (week.weekNumber === weekNumber) return { ...week, status: 'completed' };
    const next = accepted.get(week.weekNumber);
    return next && week.weekNumber > weekNumber && !sameTarget(next, week.target) ? withTargetText(week, next, tests).week : week;
  });
  const checked = safeStoredTargets({ weeks: postClose, startValue, finalTest: stored.finalTest, pathway });
  const final = checked.weeks.filter((week) => week.weekNumber > weekNumber);
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
  const nextLowered = final.find((week) => week.weekNumber === weekNumber + 1);
  if (loweredNow && week12 && final12) {
    const statedText = statedTargetText(goal.rawGoal, stored.answers ?? []);
    const line = week12LineFor([week12], final12.target as unknown as WeekTarget, statedText, startValue);
    if (line) insight = week12Sentence(line);
  } else if (nextLowered && lowered.some((item) => item.week === weekNumber + 1)) {
    // WU-46 (3): the model's sentence named a target code then lowered.
    insight = nextWeekSentence(nextLowered.target as unknown as WeekTarget);
  }
  return {
    outcome: answer.outcome,
    status: decided.status,
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
  };
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
