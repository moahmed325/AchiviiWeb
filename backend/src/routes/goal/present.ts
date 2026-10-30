// B-102: how a goal is sent to the app (presentGoal and its helpers) and the plan stream, moved out of routes/goal.ts.
import { shapeOf } from '../../lib/planLength.js';
import { Request, Response } from 'express';
import { journeyResultOf, readPreviousPlan, type JourneyGoal, type JourneyResult, type PreviousPlan } from '../../lib/nextPlan.js';
import { formatBasisBadge } from '../../lib/research/planGrounding.js';
import { goalScheduleOf, readRoutine, type GoalSchedule } from '../../lib/planV2.js';
import { weekCloseEnabled } from '../../lib/weekClose/switch.js';
import { dailyTimeCheckOf, type DailyTimeCheck, type DailyTimeWeek } from '../../lib/weekClose/dailyTime.js';


export function wantsPlanStream(req: Request): boolean {
  return (req.headers.accept || '').includes('text/event-stream');
}

export function openPlanStream(res: Response, startedAt: number) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (payload: Record<string, unknown>) => {
    const elapsedMs = Date.now() - startedAt;
    res.write(`data: ${JSON.stringify({ ...payload, elapsedMs, slow: elapsedMs > 20_000 })}\n\n`);
  };
}


/** B-109: the row's `totalWeeks` (null when a test double or an old select left it out: a 12-week plan). */
const totalWeeksOf = (goal: Record<string, unknown>): number | null => (typeof goal.totalWeeks === 'number' ? goal.totalWeeks : null);

/**
 * The daily-time check (WU-58 (1), after two weeks under half done, `dailyTime.ts`), from the stored rows. Null with
 * `WEEK_CLOSE_ENABLED` off, so a switch turned off hides it as it refuses the daily-time answer.
 */
export function dailyTimeOfGoal(goal: Record<string, unknown>): { dailyTimeCheck: DailyTimeCheck | null } {
  const weeks = goal.roadmapWeeks as DailyTimeWeek[] | undefined;
  if (!weekCloseEnabled() || !Array.isArray(weeks)) return { dailyTimeCheck: null };
  const routine = typeof goal.routine === 'string' ? goal.routine : '{}';
  return { dailyTimeCheck: dailyTimeCheckOf(weeks, readRoutine({ routine }).dailyMinutes, shapeOf({ totalWeeks: totalWeeksOf(goal) }).weeks) };
}

/** Next plan: the goal as `journeyResultOf` reads it, from a goal row with its weeks. */
export function journeyGoalOf(goal: Record<string, unknown>): JourneyGoal {
  return {
    rawGoal: typeof goal.rawGoal === 'string' ? goal.rawGoal : '',
    clarifiedOutcome: typeof goal.clarifiedOutcome === 'string' ? goal.clarifiedOutcome : null,
    roadmap: goal.roadmap,
    roadmapWeeks: goal.roadmapWeeks as JourneyGoal['roadmapWeeks'],
    dailyTasks: goal.dailyTasks as JourneyGoal['dailyTasks'],
    totalWeeks: totalWeeksOf(goal),
  };
}

/** Next plan (NP-1, NP-8): what the plan reached, and the plan it follows. No switch: it reads stored rows only. */
export function nextPlanOfGoal(goal: Record<string, unknown>): { journeyResult: JourneyResult | null; previousPlan: PreviousPlan | null } {
  return { journeyResult: journeyResultOf(journeyGoalOf(goal)), previousPlan: readPreviousPlan(goal.roadmap) };
}

/**
 * RULE-3 (B-95, B-98): the update status stays inside. No weekly tests (2026-10-30): a goal made before keeps its
 * stored targets, tests and results, which are never sent, so the app shows no test or target anywhere.
 */
export function withoutStatus(week: unknown): unknown {
  if (!week || typeof week !== 'object') return week;
  const {
    updateStatus: _status,
    target: _target,
    test: _test,
    testResult: _result,
    retestOfWeek: _retest,
    ...rest
  } = week as Record<string, unknown>;
  return rest;
}

/** The stored roadmap without what only the weekly tests used (an older goal's final test, checkpoints, lowered targets). */
export function withoutTests(roadmap: unknown): unknown {
  if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) return roadmap;
  const { finalTest: _final, checkpoints: _checkpoints, loweredTargets: _lowered, ...rest } = roadmap as Record<string, unknown>;
  return rest;
}

export function presentGoal<T extends Record<string, unknown>>(
  goal: T
): T & {
  basis: ReturnType<typeof formatBasisBadge>;
  dailyTimeCheck: DailyTimeCheck | null;
  journeyResult: JourneyResult | null;
  previousPlan: PreviousPlan | null;
  schedule: GoalSchedule | null;
} {
  const weeks = goal.roadmapWeeks;
  return {
    ...goal,
    ...dailyTimeOfGoal(goal),
    ...nextPlanOfGoal(goal),
    ...(goal.roadmap !== undefined ? { roadmap: withoutTests(goal.roadmap) } : {}),
    // RULE-3 (B-95, B-98): the status stays inside; no goal response carries `updateStatus` (nor any test or target).
    ...(Array.isArray(weeks) ? { roadmapWeeks: weeks.map(withoutStatus) } : {}),
    // B-108: the schedule in force, so the app shows what the next week will use without reading the routine itself.
    schedule: typeof goal.routine === 'string' && goal.startDate ? goalScheduleOf({ routine: goal.routine, startDate: goal.startDate as Date }) : null,
    basis: formatBasisBadge({
      methodKind: goal.methodKind as string | null | undefined,
      methodConfidence: goal.methodConfidence as string | null | undefined,
      methodName: (goal.canonicalMethodName as string | null | undefined) ?? null,
      authority: (goal.canonicalAuthority as string | null | undefined) ?? null,
    }),
  };
}

/** Answers by question id from the wizard; older clients send only `{ question: answer }`. */
