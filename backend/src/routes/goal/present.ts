// B-102: how a goal is sent to the app (presentGoal and its helpers) and the plan stream, moved out of routes/goal.ts unchanged (a pure move).
import { shapeOf } from '../../lib/planLength.js';
import { Request, Response } from 'express';
import { journeyResultOf, readPreviousPlan, type JourneyGoal, type JourneyResult, type PreviousPlan } from '../../lib/nextPlan.js';
import { safeGoalTargets, type StoredWeek, type Week12Line } from '../../lib/safety/storedTargets.js';
import { formatBasisBadge } from '../../lib/research/planGrounding.js';
import { goalScheduleOf, readRoutine, type GoalSchedule } from '../../lib/planV2.js';
import { weeklyUpdateEnabled } from '../../lib/weekClose/switch.js';
import { checkpointViewOf, dayNinetyLineOf, type CheckpointView } from '../../lib/weekClose/checkpoint.js';
import type { DayNinetyLine } from '../../lib/ai/dayNinety.js';
import { dailyTimeCheckOf, retestInfo, type DailyTimeCheck, type RetestInfo, type RetestTask, type RetestWeek } from '../../lib/weekClose/retest.js';


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


/**
 * Plan safety limits M1.3 (RULE-9, PSL-12): an older goal's targets lowered on read, and the honest week 12 line. Writes
 * nothing and logs nothing (`/active` runs on every app load). A goal without a v2 roadmap or weeks is left as it is.
 */
export function safeTargetsOf(goal: Record<string, unknown>): { roadmapWeeks: unknown; roadmap: unknown; week12Line: Week12Line | null } | null {
  const safe = safeGoalTargets({
    rawGoal: typeof goal.rawGoal === 'string' ? goal.rawGoal : '',
    clarifiedOutcome: typeof goal.clarifiedOutcome === 'string' ? goal.clarifiedOutcome : null,
    roadmap: goal.roadmap,
    roadmapWeeks: goal.roadmapWeeks as StoredWeek[] | undefined,
    totalWeeks: totalWeeksOf(goal),
  });
  if (!safe) return null;
  const roadmap = goal.roadmap as Record<string, unknown>;
  return {
    roadmapWeeks: safe.weeks,
    roadmap: safe.finalTest === roadmap.finalTest ? roadmap : { ...roadmap, finalTest: safe.finalTest },
    week12Line: safe.week12Line,
  };
}

/** B-109: the row's `totalWeeks` (null when a test double or an old select left it out: a 12-week plan). */
const totalWeeksOf = (goal: Record<string, unknown>): number | null => (typeof goal.totalWeeks === 'number' ? goal.totalWeeks : null);

/**
 * Weekly update M3.3b (WU-58 (1)): the open week's re-test and the daily-time check, from the stored rows. Both null
 * with either switch off (RULE-18), so a switch turned off hides them as it refuses the daily-time answer.
 */
export function retestOfGoal(goal: Record<string, unknown>): { retest: RetestInfo | null; dailyTimeCheck: DailyTimeCheck | null } {
  const weeks = goal.roadmapWeeks as RetestWeek[] | undefined;
  if (!weeklyUpdateEnabled() || !Array.isArray(weeks)) return { retest: null, dailyTimeCheck: null };
  const routine = typeof goal.routine === 'string' ? goal.routine : '{}';
  const tasks = Array.isArray(goal.dailyTasks) ? (goal.dailyTasks as RetestTask[]) : [];
  return { retest: retestInfo(weeks, tasks), dailyTimeCheck: dailyTimeCheckOf(weeks, readRoutine({ routine }).dailyMinutes, shapeOf({ totalWeeks: totalWeeksOf(goal) }).weeks) };
}

/**
 * Checkpoints (RULE-11, section 7): the open offer and the day-90 line, from the stored rows. Both null with either
 * switch off (RULE-1).
 */
export function checkpointOfGoal(goal: Record<string, unknown>): { checkpoint: CheckpointView | null; dayNinetyLine: DayNinetyLine | null } {
  const read = {
    rawGoal: typeof goal.rawGoal === 'string' ? goal.rawGoal : '',
    clarifiedOutcome: typeof goal.clarifiedOutcome === 'string' ? goal.clarifiedOutcome : null,
    roadmap: goal.roadmap,
    roadmapWeeks: goal.roadmapWeeks as StoredWeek[] | undefined,
    totalWeeks: totalWeeksOf(goal),
  };
  return { checkpoint: checkpointViewOf(read), dayNinetyLine: dayNinetyLineOf(read) };
}

/** Next plan: the goal as `journeyResultOf` reads it, from a goal row with its weeks. */
export function journeyGoalOf(goal: Record<string, unknown>): JourneyGoal {
  return {
    rawGoal: typeof goal.rawGoal === 'string' ? goal.rawGoal : '',
    clarifiedOutcome: typeof goal.clarifiedOutcome === 'string' ? goal.clarifiedOutcome : null,
    roadmap: goal.roadmap,
    roadmapWeeks: goal.roadmapWeeks as JourneyGoal['roadmapWeeks'],
    totalWeeks: totalWeeksOf(goal),
  };
}

/** Next plan (NP-1, NP-8): what the plan reached, and the plan it follows. No switch: it reads stored rows only. */
export function nextPlanOfGoal(goal: Record<string, unknown>): { journeyResult: JourneyResult | null; previousPlan: PreviousPlan | null } {
  return { journeyResult: journeyResultOf(journeyGoalOf(goal)), previousPlan: readPreviousPlan(goal.roadmap) };
}

export function withoutStatus(week: unknown): unknown {
  if (!week || typeof week !== 'object') return week;
  const { updateStatus: _status, ...rest } = week as Record<string, unknown>;
  return rest;
}

export function presentGoal<T extends Record<string, unknown>>(
  goal: T
): T & {
  basis: ReturnType<typeof formatBasisBadge>;
  retest: RetestInfo | null;
  dailyTimeCheck: DailyTimeCheck | null;
  checkpoint: CheckpointView | null;
  dayNinetyLine: DayNinetyLine | null;
  journeyResult: JourneyResult | null;
  previousPlan: PreviousPlan | null;
  schedule: GoalSchedule | null;
} {
  const safe = safeTargetsOf(goal);
  const weeks = safe ? safe.roadmapWeeks : goal.roadmapWeeks;
  return {
    ...goal,
    ...safe,
    ...retestOfGoal(goal),
    ...checkpointOfGoal(goal),
    ...nextPlanOfGoal(goal),
    // RULE-3 (B-95, B-98): the status stays inside; no goal response carries `updateStatus`.
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
