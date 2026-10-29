/**
 * Checkpoints (docs/features/checkpoints): the honest check at the close of week 4 or 8. This file is pure: the check
 * (RULE-3 to RULE-6, RULE-10, CP-15, CP-16), RULE-5's rounding, RULE-9's spread of the weeks after an accepted offer,
 * the stored list (`Goal.roadmap.checkpoints`, section 7) and what the goal response reads from it (RULE-11). The close
 * decides in `checkpointClose.ts` and stores in `saveWeekClose`; the answer is `POST /api/goal/checkpoint`. Everything
 * here runs only with `weeklyUpdateEnabled()` (RULE-1, CP-8).
 */
import { nextCheckWeek, pathwayFor, shownAmount, type WeekTarget } from '../ai/roadmap.js';
import { DEFAULT_SHAPE, shapeOf, type PlanShape } from '../planLength.js';
import type { DayNinetyLine } from '../ai/dayNinety.js';
import type { CertifiedPresetBlueprint } from '../ai/presets/index.js';
import { CHECKPOINT_BEHIND_PERCENT, CHECKPOINT_FLAT_PLAN_PERCENT } from '../safety/limits.js';
import { isClosedWeek, isWeekTarget, safeGoalTargets, safeStoredTargets, testOf, withTargetText, type StoredWeek } from '../safety/storedTargets.js';
import { harder, nextSafeStep, targetFamily, type FamilyContext } from '../safety/targetSteps.js';
import { weeklyUpdateEnabled } from './switch.js';

/** RULE-2: the only weeks whose close runs a checkpoint, on a 12-week plan. B-109: a goal's own are `shapeOf(goal).checkpointWeeks`. */
export const CHECKPOINT_WEEKS: readonly number[] = DEFAULT_SHAPE.checkpointWeeks;

export type NumberTarget = Extract<WeekTarget, { kind: 'number' }>;
export type CheckpointKind = 'lower' | 'raise' | 'line_only';
export type CheckpointOutcome = CheckpointKind | 'on_track' | 'none';
export type CheckpointAnswer = 'keep' | 'accept';

/** Section 7: one entry per checkpoint that made an offer. */
export interface StoredCheckpoint {
  week: number;
  kind: CheckpointKind;
  result: number;
  planned: number;
  forecast: number;
  /** The day-90 target at the offer. */
  target: number;
  /** Week 12's target when the first offer was made: the most a raise goes back up to. */
  fullGoal: number;
  /** Null for line only. */
  offered: number | null;
  answer: CheckpointAnswer | null;
  by: 'person' | 'expired' | null;
  answeredAt: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// RULE-5: rounding to the unit's step

const LB = /^(lb|lbs|pounds?)\b/;

/** RULE-5's step for a value of this target. A target's family wins over its unit (a lift in kg is 2.5, not "other"). */
export function unitStep(target: NumberTarget, value: number, context: FamilyContext = {}): number {
  const unit = target.unit.toLowerCase().trim();
  const family = targetFamily(target, context);
  if (family === 'lift_load') return LB.test(unit) ? 5 : 2.5;
  if (family === 'body_weight') return LB.test(unit) ? 1 : 0.5;
  if (family === 'body_fat') return 0.5;
  if (/^(km|kms|kilomet(?:er|re)s?|mi|mile|miles)$/.test(unit)) return 0.5;
  if (/^(m|metres?|meters?)$/.test(unit)) return 100;
  if (/^(min|mins|minutes?)$/.test(unit)) return 1;
  if (/^(s|sec|secs|seconds?)$/.test(unit)) return 5;
  if (/^(h|hr|hrs|hours?)$/.test(unit)) return 0.25;
  if (/\bkcal\b|^cal(?:orie)?s?$/.test(unit)) return 50;
  return Math.abs(value) >= 10 ? 1 : 0.5;
}

const clean = (value: number) => Math.round(value * 1e6) / 1e6;

/** RULE-5: rounded toward the easier side to the unit's step (down for higher-is-better, up for lower-is-better). */
export function roundEasier(value: number, target: NumberTarget, context: FamilyContext = {}): number {
  const step = unitStep(target, value, context);
  const steps = target.direction === 'higher_is_better' ? Math.floor(value / step + 1e-9) : Math.ceil(value / step - 1e-9);
  return clean(steps * step);
}

/** Rounded toward the harder side; only so an offer never lands on the wrong side of the result. */
function roundHarder(value: number, target: NumberTarget, context: FamilyContext): number {
  const step = unitStep(target, value, context);
  const steps = target.direction === 'higher_is_better' ? Math.ceil(value / step - 1e-9) : Math.floor(value / step + 1e-9);
  return clean(steps * step);
}

// ---------------------------------------------------------------------------------------------------------------------
// RULE-3, RULE-4, RULE-6, RULE-10: the check

export interface CheckInput {
  /** Week 12's target: its unit, metric and direction decide the family, the rounding and what "more" means. */
  target: NumberTarget;
  start: number;
  /** The closing week's target as stored. */
  planned: number;
  /** Week 12's target as stored (`safeGoalTargets`). */
  day90: number;
  fullGoal: number;
  result: number;
  /** The closing week, 4 or 8. */
  week: number;
  /** The closing week's number minus the jumped weeks before it. */
  weeksDone: number;
  context?: FamilyContext;
  /** RULE-10: week 8 after a week-4 lower was accepted; the raise check comes first. */
  raiseCheck?: boolean;
  /** RULE-9, RULE-10: whether every week spread to this raised week 12 passes the safe climb. */
  raiseIsSafe?: (offered: number) => boolean;
  /** B-109: the week of the final test (`PlanShape.finalWeek`); missing is 12. */
  finalWeek?: number;
}

export interface CheckResult {
  outcome: CheckpointOutcome;
  /** Why there is no offer when the outcome is `none`; else null. */
  reason: string | null;
  forecast: number | null;
  /** Share of the climb (RULE-4). */
  share: number | null;
  offered: number | null;
}

const none = (reason: string): CheckResult => ({ outcome: 'none', reason, forecast: null, share: null, offered: null });

/**
 * The check for one checkpoint, both directions. Every number is turned into progress along the climb ("more" is
 * lower for lower-is-better), worked out there, and turned back.
 */
export function checkpointFor(input: CheckInput): CheckResult {
  const { target, start, week } = input;
  const context = input.context ?? {};
  const sign = target.direction === 'higher_is_better' ? 1 : -1;
  const along = (value: number) => sign * (value - start);
  const back = (progress: number) => start + sign * progress;

  const climb = along(input.day90);
  if (!(climb > 1e-9)) return none('no_climb');
  const plannedProgress = along(input.planned);
  const done = along(input.result);
  const weeksLeft = (input.finalWeek ?? DEFAULT_SHAPE.finalWeek) - week;

  // RULE-3 (CP-15): the plan's own shape, or the straight line while the plan is nearly flat.
  let forecast: number;
  if (plannedProgress < (CHECKPOINT_FLAT_PLAN_PERCENT / 100) * climb) {
    const weeksDone = Math.max(1, input.weeksDone);
    forecast = done + (done / weeksDone) * weeksLeft;
  } else {
    forecast = (done / plannedProgress) * climb;
  }
  // CP-5: never past the safe climb from the result, one `nextSafeStep` per week left (a target with a family).
  let safe: number | null = input.result;
  for (let step = 0; step < weeksLeft && safe !== null; step++) safe = nextSafeStep(target, safe, context);
  if (safe !== null) forecast = Math.min(forecast, along(safe));
  forecast = Math.min(forecast, along(input.fullGoal));

  // RULE-10 (CP-16): a raise to the rounded forecast, at most the full goal, when it is a step or more past the day-90 target.
  if (input.raiseCheck) {
    const offered = Math.min(along(roundEasier(back(forecast), target, context)), along(input.fullGoal));
    const oneStep = unitStep(target, input.day90, context);
    if (offered >= climb + oneStep - 1e-9 && (input.raiseIsSafe?.(back(offered)) ?? true)) {
      return { outcome: 'raise', reason: null, forecast: clean(back(forecast)), share: clean(forecast / climb), offered: clean(back(offered)) };
    }
  }

  // RULE-4, RULE-6: measured against the day-90 target.
  forecast = Math.min(forecast, climb);
  const share = forecast / climb;
  const shown = { forecast: clean(back(forecast)), share: clean(share) };
  if (done >= climb - 1e-9 || share >= CHECKPOINT_BEHIND_PERCENT / 100) return { outcome: 'on_track', reason: null, ...shown, offered: null };
  if (done <= 1e-9) return { outcome: 'line_only', reason: null, ...shown, offered: null };
  // RULE-5: rounded easier, never on the wrong side of the result.
  let offered = along(roundEasier(back(Math.max(forecast, done)), target, context));
  if (offered < done - 1e-9) offered = along(roundHarder(input.result, target, context));
  if (!(offered < climb - 1e-9)) return { outcome: 'none', reason: 'not_easier', ...shown, offered: null };
  return { outcome: 'lower', reason: null, ...shown, offered: clean(back(offered)) };
}

// ---------------------------------------------------------------------------------------------------------------------
// RULE-9: the weeks after an accepted offer

export interface AcceptedWeeks<W extends StoredWeek> {
  /** Only the weeks whose target changes, with their code-written text (`withTargetText`). */
  weeks: W[];
  /** A pathway's week 12 `finalTest`, refilled from the preset; null when it does not change. */
  finalTest: string | null;
}

/**
 * RULE-9: week 12 takes `week12`; each week after the open week, up to week 11, is spread evenly from the open week's
 * target to it and rounded easier, never harder than it was after a lower and never easier after a raise. On a light-test
 * goal only the big weeks are spread, and every light week from the open week on shows its next big week's target (the
 * open week's test and tasks are not touched). Null when the weeks are not 12 readable number targets.
 */
export function acceptedWeeks<W extends StoredWeek>(
  rows: W[],
  openWeek: number,
  week12: number,
  kind: 'lower' | 'raise',
  pathway: Pick<CertifiedPresetBlueprint, 'id' | 'weeklyTests'> | null,
  shape: PlanShape = DEFAULT_SHAPE
): AcceptedWeeks<W> | null {
  const final = shape.finalWeek;
  const byWeek = new Map(rows.map((week) => [week.weekNumber, week]));
  const ordered = Array.from({ length: shape.weeks }, (_, index) => byWeek.get(index + 1));
  if (ordered.some((week) => !week || !isWeekTarget(week.target) || (week.target as WeekTarget).kind !== 'number')) return null;
  const open = byWeek.get(openWeek);
  if (!open || openWeek >= final) return null;
  const context = { run10k: pathway?.id === 'run10k' };
  const light = (week: W) => testOf(week)?.light === true;
  const lightGoal = rows.some(light);
  const from = (open.target as NumberTarget).value;

  const values = new Map<number, number>([[final, week12]]);
  // B-109: the ready week keeps the final week's target.
  if (shape.readyWeek !== null && !isClosedWeek(byWeek.get(shape.readyWeek)!)) values.set(shape.readyWeek, week12);
  for (let weekNumber = openWeek + 1; weekNumber < final; weekNumber++) {
    const week = byWeek.get(weekNumber)!;
    if (lightGoal && light(week)) continue;
    const target = week.target as NumberTarget;
    const spread = roundEasier(from + ((week12 - from) * (weekNumber - openWeek)) / (final - openWeek), target, context);
    const keepsOld = kind === 'lower' ? harder(spread, target.value, target.direction) : harder(target.value, spread, target.direction);
    values.set(weekNumber, keepsOld ? target.value : spread);
  }
  if (lightGoal) {
    for (const week of rows) {
      if (week.weekNumber >= openWeek && week.weekNumber < final && light(week) && !isClosedWeek(week)) {
        const check = nextCheckWeek(week.weekNumber, shape);
        const big = values.get(check) ?? (byWeek.get(check)!.target as NumberTarget).value;
        values.set(week.weekNumber, big);
      }
    }
  }

  let finalTest: string | null = null;
  const weeks: W[] = [];
  for (const [weekNumber, value] of [...values.entries()].sort((a, b) => a[0] - b[0])) {
    const week = byWeek.get(weekNumber)!;
    const target = week.target as NumberTarget;
    if (Math.abs(target.value - value) < 1e-9) continue;
    const rebuilt = withTargetText(week, { ...target, value }, pathway?.weeklyTests, shape);
    if (rebuilt.finalTest !== null) finalTest = rebuilt.finalTest;
    weeks.push(rebuilt.week);
  }
  return { weeks, finalTest };
}

/** RULE-9, RULE-10: the weeks after a raise pass the safe climb when reading them back lowers nothing. */
export function spreadIsSafe<W extends StoredWeek>(
  rows: W[],
  changed: readonly W[],
  startValue: number | null,
  finalTest: string,
  pathway: Pick<CertifiedPresetBlueprint, 'id' | 'weeklyTests'> | null,
  shape: PlanShape = DEFAULT_SHAPE
): boolean {
  const byWeek = new Map(changed.map((week) => [week.weekNumber, week]));
  const weeks = rows.map((week) => byWeek.get(week.weekNumber) ?? week);
  return safeStoredTargets({ weeks, startValue, finalTest, pathway, shape }).foundNow.length === 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Section 7: the stored list

/** `Goal.roadmap.checkpoints`; a missing or unreadable list means none. */
export function readCheckpoints(roadmap: unknown): StoredCheckpoint[] {
  const list = roadmap && typeof roadmap === 'object' ? (roadmap as Record<string, unknown>).checkpoints : null;
  return Array.isArray(list) ? list.filter((item): item is StoredCheckpoint => Boolean(item) && typeof item === 'object' && typeof item.week === 'number') : [];
}

/** The open offer (not answered yet), or null. At most one is ever open: the next close expires it. */
export function openCheckpoint(list: readonly StoredCheckpoint[]): StoredCheckpoint | null {
  return list.find((item) => item.answer === null || item.answer === undefined) ?? null;
}

/** RULE-8: every open offer stored as `keep` by `expired`. */
export function expireOpen(list: readonly StoredCheckpoint[], now: Date): { list: StoredCheckpoint[]; expired: StoredCheckpoint[] } {
  const expired: StoredCheckpoint[] = [];
  const next = list.map((item) => {
    if (item.answer !== null && item.answer !== undefined) return item;
    const answered = { ...item, answer: 'keep' as const, by: 'expired' as const, answeredAt: now.toISOString() };
    expired.push(answered);
    return answered;
  });
  return { list: next, expired };
}

/** RULE-13: the line each answer logs, word for word. */
export function answerLogLine(goalId: string, item: Pick<StoredCheckpoint, 'week' | 'answer' | 'by'>): string {
  return `[Checkpoint] goal ${goalId} week ${item.week} answer ${item.answer} by ${item.by}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// RULE-11, section 7: what the goal response reads

type GoalRead = { rawGoal: string; clarifiedOutcome: string | null; roadmap: unknown; roadmapWeeks: StoredWeek[] | undefined; totalWeeks?: number | null };

function week12Of(goal: GoalRead): { target: NumberTarget; goal: string | null } | null {
  const safe = safeGoalTargets(goal);
  const target = safe?.weeks.find((week) => week.weekNumber === shapeOf(goal).finalWeek)?.target;
  if (!safe || !isWeekTarget(target) || target.kind !== 'number') return null;
  return { target, goal: safe.week12Line?.goal ?? null };
}

/** Section 3: the goal shown, `week12Line`'s goal when safety lowered week 12, else the full goal; as RULE-7 shows amounts. */
function goalShown(week12: { target: NumberTarget; goal: string | null }, fullGoal: number): string {
  if (week12.goal) return `${week12.goal}${week12.target.direction === 'lower_is_better' ? ' or less' : ''}`;
  return shownAmount({ ...week12.target, value: fullGoal });
}

/** RULE-11: while an accepted offer leaves week 12 below the full goal; null otherwise and with either switch off. */
export function dayNinetyLineOf(goal: GoalRead): DayNinetyLine | null {
  if (!weeklyUpdateEnabled()) return null;
  const list = readCheckpoints(goal.roadmap);
  if (!list.some((item) => item.answer === 'accept')) return null;
  const week12 = week12Of(goal);
  if (!week12 || !harder(list[0].fullGoal, week12.target.value, week12.target.direction)) return null;
  const shape = shapeOf(goal);
  return {
    target: shownAmount(week12.target),
    goal: goalShown(week12, list[0].fullGoal),
    ...(shape.readyWeek !== null ? { finalWeek: shape.finalWeek } : {}),
  };
}

/** Section 7: the open offer as the goal response sends it; amounts as RULE-7 shows them. */
export interface CheckpointView {
  week: number;
  kind: CheckpointKind;
  target: string;
  offered: string | null;
  goal: string;
  /** Week 8 (B-109: the goal's last checkpoint week): worded as the last check. */
  last: boolean;
  /** A raise all the way back to the full goal (section 6 words it without "about"). */
  toFullGoal: boolean;
}

export function checkpointViewOf(goal: GoalRead): CheckpointView | null {
  if (!weeklyUpdateEnabled()) return null;
  const list = readCheckpoints(goal.roadmap);
  const open = openCheckpoint(list);
  const week12 = open ? week12Of(goal) : null;
  if (!open || !week12) return null;
  const amount = (value: number) => shownAmount({ ...week12.target, value });
  return {
    week: open.week,
    kind: open.kind,
    target: amount(open.target),
    offered: open.offered === null ? null : amount(open.offered),
    goal: goalShown(week12, list[0].fullGoal),
    last: open.week === shapeOf(goal).checkpointWeeks[shapeOf(goal).checkpointWeeks.length - 1],
    toFullGoal: open.kind === 'raise' && open.offered !== null && Math.abs(open.offered - list[0].fullGoal) < 1e-9,
  };
}

/** The pathway as the check and the spread read it. */
export const pathwayOf = (goal: { rawGoal: string; clarifiedOutcome: string | null }) => pathwayFor(goal.rawGoal, goal.clarifiedOutcome);
