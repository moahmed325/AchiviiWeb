/**
 * Weekly update M3.2: one recorded case of a run as the plain facts `score.ts` scores. This is the only part of the
 * scoring that uses product code: the goal is rebuilt exactly as the run built it, and the safety check reads the goal
 * as it would be saved with the product's own read (`safeGoalTargets`), not the log.
 */
import type { RoadmapWeek } from '@prisma/client';
import type { WeekTarget } from '../../src/lib/ai/roadmap.js';
import { safeGoalTargets, isWeekTarget } from '../../src/lib/safety/storedTargets.js';
import { harder } from '../../src/lib/safety/targetSteps.js';
import { dayRows, goalRow, roadmapRows, type EvalCase, type RoadmapEntry, type WeekEntry } from './cases.js';
import { rejectionOf, splitReasons, type CaseFacts, type Direction, type Hold } from './score.js';

/** What the run file holds for one case (see `CaseRun` in run.ts). */
export interface RecordedCase {
  caseId: string;
  ms: number;
  update: {
    outcome: 'accepted' | 'retry_accepted' | 'fallback';
    status: string | null;
    insight: string;
    weeks: Array<{ weekNumber: number; target: WeekTarget; objective: string; keyMilestone: string; test: unknown }>;
    lowered: Array<{ week: number; model: number; safe: number }>;
    reasons: string[];
  } | null;
  modelCalls: Array<{ prompt: string; answer: string | null; status: number; ms: number }>;
  standIn: Array<{ answered: boolean }>;
}

const RETRY_MARK = 'YOUR PREVIOUS ANSWER WAS REJECTED';

export function sameTarget(a: unknown, b: unknown): boolean {
  if (!isWeekTarget(a) || !isWeekTarget(b) || a.kind !== b.kind) return false;
  if (a.kind === 'deliverable') return b.kind === 'deliverable' && a.description === b.description;
  return b.kind === 'number' && Math.abs(a.value - b.value) < 1e-9 && a.unit === b.unit && a.metric === b.metric;
}

/** Next week's target against this week's: harder, the same, or easier (a deliverable is held only by the same text). */
export function directionOf(now: WeekTarget, next: WeekTarget): Direction {
  if (now.kind === 'deliverable' || next.kind === 'deliverable') return sameTarget(now, next) ? 'hold' : 'raise';
  if (Math.abs(now.value - next.value) < 1e-9) return 'hold';
  return harder(next.value, now.value, now.direction) ? 'raise' : 'lower';
}

/** The holds the prompt put in force (code's), plus far_behind when the status set it and next week does not show week 12. */
export function holdsFromPrompt(prompt: string, status: string | null): Hold[] {
  const holds: Hold[] = [];
  if (status === 'far_behind' && /\n {3}- far_behind: week \d+'s target equals this week's target\./.test(prompt)) holds.push('far_behind');
  if (/\n {3}- The test was not logged: week \d+'s target must not be higher/.test(prompt)) holds.push('not_logged');
  if (/\n {3}- They are a week behind in /.test(prompt)) holds.push('week_behind');
  return holds;
}

function parseAnswer(answer: string | null): { nextTargets?: Array<{ weekNumber?: number; value?: unknown }> } | null {
  if (!answer) return null;
  try {
    return JSON.parse(answer);
  } catch {
    return null;
  }
}

/** Per answer with a readable value for the week `safeMax` names: was it past `safeMax`. */
export function aboveSafeMaxOf(calls: RecordedCase['modelCalls'], direction: 'higher_is_better' | 'lower_is_better' | null): boolean[] {
  if (!direction) return [];
  return calls.flatMap((call) => {
    const max = call.prompt.match(/- The most week (\d+) may be: (-?\d+(?:\.\d+)?)/);
    const answer = parseAnswer(call.answer);
    if (!max || !answer || !Array.isArray(answer.nextTargets)) return [];
    const item = answer.nextTargets.find((row) => Number(row?.weekNumber) === Number(max[1]));
    return typeof item?.value === 'number' ? [harder(item.value, Number(max[2]), direction)] : [];
  });
}

export function factsOf(recorded: RecordedCase, c: EvalCase, entry: RoadmapEntry, week: WeekEntry, rawGoal: string): CaseFacts {
  const rows = roadmapRows(entry, c);
  const goal = goalRow(entry, c, rawGoal, rows, dayRows(c, week.days));
  const read = safeGoalTargets(goal)?.weeks ?? goal.roadmapWeeks;
  const targetOf = (weeks: readonly { weekNumber: number; target: unknown }[], n: number) => weeks.find((item) => item.weekNumber === n)?.target as WeekTarget | undefined;
  const update = recorded.update;
  const stored = new Map((update?.weeks ?? []).map((item) => [item.weekNumber, item]));

  // The goal as the close would save it: this week completed, the update's weeks stored.
  const afterSave = goal.roadmapWeeks.map((row): RoadmapWeek => {
    if (row.weekNumber === c.week) return { ...row, status: 'completed' };
    const next = stored.get(row.weekNumber);
    return next ? { ...row, target: next.target as never, objective: next.objective, keyMilestone: next.keyMilestone, test: next.test as never } : row;
  });
  const returned = read.map((row) => (stored.has(row.weekNumber) ? { weekNumber: row.weekNumber, target: stored.get(row.weekNumber)!.target } : { weekNumber: row.weekNumber, target: row.target }));
  const reread = safeGoalTargets({ ...goal, roadmapWeeks: afterSave })?.weeks ?? afterSave;
  const climbBreaks = returned
    .filter((row) => row.weekNumber > c.week && !sameTarget(row.target, targetOf(reread, row.weekNumber)))
    .map((row) => row.weekNumber);

  const now = targetOf(read, c.week)!;
  const nextAfter = targetOf(returned, c.week + 1);
  const nextPlan = targetOf(read, c.week + 1);
  let vsPlan: CaseFacts['vsPlan'] = null;
  if (nextAfter && nextPlan) {
    const d = directionOf(nextPlan, nextAfter);
    vsPlan = d === 'hold' ? 'as_planned' : d === 'raise' ? 'above_plan' : 'below_plan';
  }

  const firstPrompt = recorded.modelCalls.find((call) => !call.prompt.includes(RETRY_MARK))?.prompt ?? '';
  const status = update?.status ?? null;
  const { first, retry } = splitReasons(update?.reasons ?? [], rejectionOf(recorded.modelCalls.map((call) => call.prompt)));
  return {
    caseId: c.id,
    goalId: c.goalId,
    outcome: update?.outcome ?? 'did_not_run',
    status,
    insight: update?.insight ?? '',
    reasonsFirst: first,
    reasonsRetry: retry,
    direction: nextAfter ? directionOf(now, nextAfter) : null,
    vsPlan,
    holds: holdsFromPrompt(firstPrompt, status),
    lowered: (update?.lowered ?? []).map(({ week, model, safe }) => ({ week, model, safe })),
    week12Kept: sameTarget(targetOf(returned, 12), targetOf(read, 12)),
    aboveSafeMax: aboveSafeMaxOf(recorded.modelCalls, now.kind === 'number' ? now.direction : null),
    climbBreaks,
    detailNull: firstPrompt.includes('Key sessions, 10-minute versions, missed and dropped days: not counted.'),
    standInMisses: recorded.standIn.filter((call) => !call.answered).length,
    ms: recorded.ms,
    retryMs: recorded.modelCalls.filter((call) => call.prompt.includes(RETRY_MARK)).reduce((sum, call) => sum + call.ms, 0),
  };
}
