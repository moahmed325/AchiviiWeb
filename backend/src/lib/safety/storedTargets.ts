/**
 * Plan safety limits M1.3 (RULE-9, PSL-7, PSL-11 Q1, PSL-12): an older goal's stored targets lowered on read. A goal
 * stored before M1.2 was never checked, so its targets can climb faster than a safe step; what the app shows
 * (`presentGoal`) and what the week writer is told (`writeNextWeek`) use the lowered targets, and nothing stored is
 * rewritten. The same check as goal create, so a goal created since M1.2 comes back unchanged. Pure.
 */
import {
  BIG_TEST_WEEKS,
  formatAmount,
  formatTarget,
  keyMilestoneText,
  measuredPathwayTest,
  nextCheckWeek,
  pathwayFor,
  statedTargetMet,
  statedTargetText,
  TOTAL_WEEKS,
  type LoweredTarget,
  type PlanAnswer,
  type WeekTarget,
  type WeekTest,
} from '../ai/roadmap.js';
import type { CertifiedPresetBlueprint } from '../ai/presets/index.js';
import { extractStatedTargets } from '../research/statedTarget.js';
import { safeCheckWeekClimb, safeTargetClimb } from './targetSteps.js';

/** What the check reads of a stored `RoadmapWeek` row; every other field is passed through as stored. */
export interface StoredWeek {
  weekNumber: number;
  target: unknown;
  test: unknown;
  objective: string;
  keyMilestone: string;
}

export interface StoredTargetsInput<W extends StoredWeek> {
  weeks: W[];
  /** The stored roadmap's `startingPoint.value`. */
  startValue: number | null;
  finalTest: string;
  /** M1.2: the weeks goal create lowered (`Goal.roadmap.loweredTargets`); missing means none. */
  loweredTargets?: LoweredTarget[];
  /** `pathwayFor(rawGoal, clarifiedOutcome)`: decides run10k's family reading and the pathway's tests. */
  pathway: Pick<CertifiedPresetBlueprint, 'id' | 'weeklyTests'> | null;
}

export interface SafeStoredTargets<W extends StoredWeek> {
  /** In the input's order; a week whose target did not change is the stored object itself. */
  weeks: W[];
  finalTest: string;
  /** The stored `loweredTargets` and the ones found now, one entry per week. */
  lowered: LoweredTarget[];
  /** Only the ones found now (an older goal): what `writeNextWeek` logs as `lowered_on_read`. */
  foundNow: LoweredTarget[];
}

type NumberTarget = Extract<WeekTarget, { kind: 'number' }>;

function isWeekTarget(value: unknown): value is WeekTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Record<string, unknown>;
  return (target.kind === 'number' && typeof target.value === 'number') || target.kind === 'deliverable';
}

function testOf(week: StoredWeek): WeekTest | null {
  return week.test && typeof week.test === 'object' ? (week.test as WeekTest) : null;
}

const PASS_IF = ' Pass if: ';

/**
 * RULE-9, PSL-11 Q1 and Q14: a goal with no light test is checked on all 12 weeks; one with any light test on weeks 4,
 * 8 and 12 only, four safe steps apart, and each light week then takes its big week's lowered target. PSL-7, PSL-12
 * (3): only what code wrote from a changed target is rebuilt. Anything that is not 12 weeks of readable targets comes
 * back as stored.
 */
export function safeStoredTargets<W extends StoredWeek>(input: StoredTargetsInput<W>): SafeStoredTargets<W> {
  const stored = input.loweredTargets ?? [];
  const unchanged: SafeStoredTargets<W> = { weeks: input.weeks, finalTest: input.finalTest, lowered: stored, foundNow: [] };
  const byWeek = new Map(input.weeks.map((week) => [week.weekNumber, week]));
  const ordered = Array.from({ length: TOTAL_WEEKS }, (_, index) => byWeek.get(index + 1));
  if (input.weeks.length !== TOTAL_WEEKS || ordered.some((week) => !week || !isWeekTarget(week.target))) return unchanged;
  const rows = ordered as W[];
  const targets = rows.map((week) => week.target as WeekTarget);
  const context = { run10k: input.pathway?.id === 'run10k' };

  const safe = new Map<number, WeekTarget>();
  let found: LoweredTarget[];
  if (rows.some((week) => testOf(week)?.light === true)) {
    const climb = safeCheckWeekClimb(
      BIG_TEST_WEEKS.map((week) => targets[week - 1]),
      [...BIG_TEST_WEEKS],
      input.startValue,
      context
    );
    found = climb.lowered;
    BIG_TEST_WEEKS.forEach((week, index) => safe.set(week, climb.targets[index]));
    for (const week of rows) {
      const big = nextCheckWeek(week.weekNumber);
      if (testOf(week)?.light === true && found.some((item) => item.week === big)) safe.set(week.weekNumber, { ...(safe.get(big) as WeekTarget) });
    }
  } else {
    const climb = safeTargetClimb(targets, input.startValue, context);
    found = climb.lowered;
    climb.targets.forEach((target, index) => safe.set(index + 1, target));
  }

  const changed = (week: W) => {
    const before = week.target as WeekTarget;
    const after = safe.get(week.weekNumber);
    return before.kind === 'number' && after?.kind === 'number' && after.value !== before.value ? after : null;
  };
  const tests = input.pathway?.weeklyTests;
  let finalTest = input.finalTest;
  const weeks = input.weeks.map((week): W => {
    const target = changed(week);
    if (!target) return week;
    const storedTest = testOf(week);
    let test: WeekTest | null = storedTest;
    let keyMilestone = week.keyMilestone;
    if (storedTest?.light === true) {
      // A light test does not name the target: it and its milestone stay as written.
    } else if (tests) {
      test = measuredPathwayTest(tests, target);
      keyMilestone = keyMilestoneText(test);
      if (week.weekNumber === TOTAL_WEEKS) finalTest = test.instructions;
    } else {
      // A custom goal's test was written by the model: only its pass mark, which code reads as the target, changes.
      if (storedTest) test = { ...storedTest, passIf: formatTarget(target) };
      const cut = week.keyMilestone.lastIndexOf(PASS_IF);
      if (cut >= 0) keyMilestone = `${week.keyMilestone.slice(0, cut)}${PASS_IF}${formatTarget(target)}`;
    }
    return { ...week, target, test, objective: formatTarget(target), keyMilestone };
  });

  const known = new Set(stored.map((item) => item.week));
  const foundNow = found.filter((item) => !known.has(item.week));
  const lowered = [...stored, ...foundNow].sort((a, b) => a.week - b.week);
  return { weeks, finalTest, lowered, foundNow };
}

/** PSL-12 (1): the honest week 12 line's two numbers, rounded amount and unit. */
export interface Week12Line {
  safe: string;
  /** The number the person named that the safe week 12 no longer meets; null when the lowered number was the model's. */
  goal: string | null;
}

/**
 * RULE-3, PSL-12 (1): set whenever week 12 was lowered (at create or on read). `goal` is a stated number (read from the
 * same text goal create reads) that week 12 met before lowering and no longer meets.
 */
export function week12LineFor(lowered: LoweredTarget[], week12: WeekTarget | null, statedText: string, startValue: number | null): Week12Line | null {
  const entry = lowered.find((item) => item.week === TOTAL_WEEKS);
  if (!entry || !week12 || week12.kind !== 'number') return null;
  const before: NumberTarget = { ...week12, value: entry.model };
  const missed = extractStatedTargets(statedText).find(
    (item) => !statedTargetMet(week12, item, startValue) && statedTargetMet(before, item, startValue)
  );
  // Both in week 12's unit: the stated number matched it ("%" and "percent" are one unit), so the line reads as one.
  return { safe: formatAmount(week12.value, week12.unit), goal: missed ? formatAmount(missed.value, week12.unit) : null };
}

interface StoredRoadmapShape {
  finalTest?: unknown;
  startingPoint?: { value?: unknown } | null;
  loweredTargets?: LoweredTarget[];
  answers?: PlanAnswer[];
  method?: unknown;
}

export interface SafeGoal<W extends StoredWeek> extends SafeStoredTargets<W> {
  week12Line: Week12Line | null;
}

/**
 * One goal as `presentGoal` and `writeNextWeek` read it: null when it has no v2 roadmap (`Goal.roadmap` with a method)
 * or no weeks, which are then used as stored.
 */
export function safeGoalTargets<W extends StoredWeek>(goal: {
  rawGoal: string;
  clarifiedOutcome: string | null;
  roadmap: unknown;
  roadmapWeeks: W[] | undefined;
}): SafeGoal<W> | null {
  const roadmap = goal.roadmap as StoredRoadmapShape | null;
  if (!roadmap || typeof roadmap !== 'object' || !roadmap.method || !Array.isArray(goal.roadmapWeeks)) return null;
  const startValue = typeof roadmap.startingPoint?.value === 'number' ? roadmap.startingPoint.value : null;
  const result = safeStoredTargets({
    weeks: goal.roadmapWeeks,
    startValue,
    finalTest: typeof roadmap.finalTest === 'string' ? roadmap.finalTest : '',
    loweredTargets: Array.isArray(roadmap.loweredTargets) ? roadmap.loweredTargets : undefined,
    pathway: pathwayFor(goal.rawGoal, goal.clarifiedOutcome),
  });
  const week12 = result.weeks.find((week) => week.weekNumber === TOTAL_WEEKS)?.target;
  const statedText = statedTargetText(goal.rawGoal, Array.isArray(roadmap.answers) ? roadmap.answers : []);
  return { ...result, week12Line: week12LineFor(result.lowered, isWeekTarget(week12) ? week12 : null, statedText, startValue) };
}
