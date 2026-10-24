/**
 * Checkpoints (RULE-1, RULE-2, RULE-10, RULE-13): what the close of week 4 or 8 decides, after the weekly update decided
 * the targets. Read only and pure: `saveWeekClose` stores the offer inside the close's transaction, and logs these lines
 * only when its close wins. Empty with either switch off.
 */
import type { LoweredTarget, WeekTarget } from '../ai/roadmap.js';
import { TOTAL_WEEKS } from '../ai/roadmap.js';
import { sameUnit } from '../research/statedTarget.js';
import { safeGoalTargets, testOf, isWeekTarget } from '../safety/storedTargets.js';
import {
  CHECKPOINT_WEEKS,
  acceptedWeeks,
  checkpointFor,
  pathwayOf,
  readCheckpoints,
  spreadIsSafe,
  type CheckResult,
  type NumberTarget,
  type StoredCheckpoint,
} from './checkpoint.js';
import { jumpedWeeks, type ClosingGoal, type WeekMove } from './close.js';
import { weeklyUpdateEnabled } from './switch.js';
import { isLogged, resultNumber, withUpdatedTargets, type PlannedUpdate } from './update.js';

/** One checkpoint's decision: its RULE-13 line, and the entry to append when it made an offer. */
export interface CloseCheckpoint {
  week: number;
  line: string;
  entry: StoredCheckpoint | null;
}

const fmt = (value: number | null | undefined) => (value === null || value === undefined ? 'none' : String(Math.round(value * 100) / 100));

/** RULE-13: the line each checkpoint logs, word for word. */
export function checkpointLogLine(goalId: string, week: number, values: { result?: number | null; planned?: number | null; forecast?: number | null; share?: number | null; outcome: string; reason: string | null }): string {
  return `[Checkpoint] goal ${goalId} week ${week} result ${fmt(values.result)} planned ${fmt(values.planned)} forecast ${fmt(values.forecast)} share ${fmt(values.share)} outcome ${values.outcome} reason ${values.reason ?? 'none'}`;
}

/**
 * The checkpoints this close decides: a jumped week 4 or 8 logs `none` with reason `jumped` (CP-7), and the closing week,
 * when it is 4 or 8, runs the check. `testResult` is the result the close stores (the review's, else the one logged).
 */
export function checkpointsAtClose(
  goal: ClosingGoal,
  weekNumber: number,
  context: { testResult: unknown; move: WeekMove | null | undefined; update: PlannedUpdate | null | undefined }
): CloseCheckpoint[] {
  if (!weeklyUpdateEnabled()) return [];
  const skip = (week: number, reason: string): CloseCheckpoint => ({ week, line: checkpointLogLine(goal.id, week, { outcome: 'none', reason }), entry: null });
  const out = jumpedWeeks(weekNumber, context.move).filter((week) => CHECKPOINT_WEEKS.includes(week)).map((week) => skip(week, 'jumped'));
  if (!CHECKPOINT_WEEKS.includes(weekNumber)) return out;
  out.push(decide(goal, weekNumber, context, skip));
  return out;
}

function decide(
  goal: ClosingGoal,
  weekNumber: number,
  context: { testResult: unknown; move: WeekMove | null | undefined; update: PlannedUpdate | null | undefined },
  skip: (week: number, reason: string) => CloseCheckpoint
): CloseCheckpoint {
  // CP-7: a break has none (the welcome back and the re-test come first).
  if (context.move && context.move.breakDays !== null) return skip(weekNumber, 'break');

  // The goal as it reads once this close is saved: the update's targets and week 12's entry, this week closed.
  const updated = withUpdatedTargets(goal, context.update ?? null);
  const roadmap = { ...((goal.roadmap ?? {}) as Record<string, unknown>) };
  if (context.update?.week12) {
    const kept = Array.isArray(roadmap.loweredTargets) ? (roadmap.loweredTargets as LoweredTarget[]).filter((item) => item.week !== TOTAL_WEEKS) : [];
    roadmap.loweredTargets = [...kept, context.update.week12];
  }
  if (context.update?.finalTest) roadmap.finalTest = context.update.finalTest;
  const roadmapWeeks = updated.roadmapWeeks.map((week) => (week.weekNumber === weekNumber ? { ...week, status: 'completed' } : week));
  const safe = safeGoalTargets({ ...updated, roadmap, roadmapWeeks });
  const rows = safe?.weeks ?? [];
  const week = rows.find((item) => item.weekNumber === weekNumber);
  const last = rows.find((item) => item.weekNumber === TOTAL_WEEKS);
  if (!safe || rows.length !== TOTAL_WEEKS || !week || !last || !isWeekTarget(week.target) || !isWeekTarget(last.target)) return skip(weekNumber, 'unreadable');
  const planned = week.target as WeekTarget;
  const target = last.target as WeekTarget;

  // CP-5: a number target and a starting point.
  if (planned.kind !== 'number' || target.kind !== 'number') return skip(weekNumber, 'deliverable');
  const startingPoint = (roadmap.startingPoint ?? null) as { value?: unknown } | null;
  const start = typeof startingPoint?.value === 'number' && Number.isFinite(startingPoint.value) ? startingPoint.value : null;
  if (start === null) return skip(weekNumber, 'no_start');
  // CP-7: a measured result of this week in the target's unit.
  if (testOf(week)?.light === true) return skip(weekNumber, 'light_test');
  if (!isLogged(context.testResult)) return skip(weekNumber, 'not_logged');
  const result = resultNumber(context.testResult, planned);
  if (result === null || !sameUnit(planned.unit, target.unit) || planned.direction !== target.direction) return skip(weekNumber, 'unit');

  const list = readCheckpoints(goal.roadmap);
  if (list.some((item) => item.week === weekNumber)) return skip(weekNumber, 'already_offered');
  const day90 = target.value;
  const fullGoal = list[0]?.fullGoal ?? day90;
  const pathway = pathwayOf(goal);
  const context10k = { run10k: pathway?.id === 'run10k' };
  const openWeek = weekNumber + 1;
  const weeksDone = weekNumber - goal.roadmapWeeks.filter((item) => item.weekNumber < weekNumber && item.jumped).length;
  const raiseCheck = weekNumber === 8 && list.some((item) => item.week === 4 && item.kind === 'lower' && item.answer === 'accept');
  const finalTest = typeof roadmap.finalTest === 'string' ? roadmap.finalTest : '';

  const check: CheckResult = checkpointFor({
    target: target as NumberTarget,
    start,
    planned: planned.value,
    day90,
    fullGoal,
    result,
    week: weekNumber,
    weeksDone,
    context: context10k,
    raiseCheck,
    raiseIsSafe: (offered) => {
      const spread = acceptedWeeks(rows, openWeek, offered, 'raise', pathway);
      return spread !== null && spreadIsSafe(rows, spread.weeks, start, finalTest, pathway);
    },
  });
  const line = checkpointLogLine(goal.id, weekNumber, { result, planned: planned.value, forecast: check.forecast, share: check.share, outcome: check.outcome, reason: check.reason });
  const kind = check.outcome === 'lower' || check.outcome === 'raise' || check.outcome === 'line_only' ? check.outcome : null;
  const entry: StoredCheckpoint | null = kind
    ? {
        week: weekNumber,
        kind,
        result,
        planned: planned.value,
        forecast: check.forecast ?? result,
        target: day90,
        fullGoal,
        offered: check.offered,
        answer: null,
        by: null,
        answeredAt: null,
      }
    : null;
  return { week: weekNumber, line, entry };
}
