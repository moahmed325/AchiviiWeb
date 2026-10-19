import type { DailyTask, Goal, Prisma, RoadmapWeek as RoadmapWeekRow } from '@prisma/client';
import { prisma } from './prisma.js';
import {
  formatTarget,
  TOTAL_WEEKS,
  type ChosenMethod,
  type PlanAnswer,
  type Roadmap,
  type RoadmapPhase,
  type StartingPoint,
  type WeekTarget,
  type WeekTest,
} from './ai/roadmap.js';
import { activeDaysFor, generateWeekPlan, type PlanVariant, type WeekDayPlan } from './ai/weekPlan.js';
import { parseStoredSteps } from './carryForward.js';
import { isHighLoadGoal } from './highLoad.js';
import { handoffBrief, placeHandoff, weekHandoff, type HandoffPlacement, type HandoffTask, type WeekHandoff } from './recovery/handoff.js';
import { readRecoveryProfile, type RecoveryProfile } from './recovery/profile.js';
import { methodRecoveryEnabled } from './recovery/switch.js';
import { withFirstWeekBackLines } from './recovery/firstWeekBack.js';
import type { FirstWeekBack } from './weekClose/breaks.js';

/** What `Goal.roadmap` holds for a v2 goal. The 12 weeks live in `RoadmapWeek` rows. */
export interface StoredRoadmap {
  finalGoal: string;
  finalTest: string;
  startingPoint: StartingPoint;
  method: ChosenMethod;
  phases: RoadmapPhase[];
  answers: PlanAnswer[];
  /** Method-aware recovery (MR-9): the goal's checked recovery profile. Missing on goals created before it. */
  recovery?: RecoveryProfile;
}

export function storedRoadmap(roadmap: Roadmap, answers: PlanAnswer[], recovery?: RecoveryProfile | null): StoredRoadmap {
  const { weeks: _weeks, ...rest } = roadmap;
  return recovery ? { ...rest, answers, recovery } : { ...rest, answers };
}

function json<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

export function weekStartFor(goalStart: Date, weekNumber: number): Date {
  const start = new Date(goalStart);
  start.setUTCDate(start.getUTCDate() + (weekNumber - 1) * 7);
  return start;
}

export function roadmapWeekRows(goalId: string, roadmap: Roadmap, dailyMinutes: number, planVariant: PlanVariant) {
  return roadmap.weeks.map((week) => ({
    goalId,
    weekNumber: week.weekNumber,
    phase: week.phase,
    theme: week.focus,
    objective: formatTarget(week.target),
    keyMilestone: `${week.test.instructions} Pass if: ${week.test.passIf}`,
    targetIntensity: Math.round(60 + (40 * (week.weekNumber - 1)) / (TOTAL_WEEKS - 1)),
    plannedMinutes: dailyMinutes * activeDaysFor(planVariant),
    target: json(week.target),
    test: json(week.test),
    status: week.weekNumber === 1 ? 'active' : 'pending',
  }));
}

/** `notOfferedBefore` (WU-13, M1.4): every row dated before this local date ('YYYY-MM-DD') is stored not offered. */
export function dailyTaskRows(goalId: string, weekNumber: number, days: WeekDayPlan[], notOfferedBefore?: string) {
  return days.map((day) => ({
    goalId,
    weekNumber,
    dayNumber: (weekNumber - 1) * 7 + day.dayNumber,
    date: day.date,
    dayOfWeek: day.dayOfWeek,
    title: day.title,
    isRestDay: day.isRestDay,
    durationMinutes: day.durationMinutes,
    slotTime: day.slotTime,
    implementationIntention: day.implementationIntention,
    detailedSteps: JSON.stringify(day.detailedSteps),
    resourceType: 'guide',
    isKeySession: day.isKeySession,
    isTestDay: day.isTestDay,
    whyToday: day.whyToday || null,
    minimumVersion: day.minimumVersion ? json(day.minimumVersion) : undefined,
    status: 'pending',
    ...(notOfferedBefore && day.date < notOfferedBefore ? { notOffered: true } : {}),
  }));
}

export function readStoredRoadmap(goal: Pick<Goal, 'roadmap'>): StoredRoadmap | null {
  const value = goal.roadmap as unknown as StoredRoadmap | null;
  return value && typeof value === 'object' && value.method ? value : null;
}

interface RoutineShape {
  dailyMinutes?: number;
  planVariant?: PlanVariant;
  preferredSlot?: string;
  /** 'HH:MM', written at goal create. Read and validated by `missedSessions.ts`. */
  sleepTime?: string;
}

export function readRoutine(goal: Pick<Goal, 'routine'>): Required<Pick<RoutineShape, 'dailyMinutes' | 'planVariant'>> & RoutineShape {
  let routine: RoutineShape = {};
  try {
    routine = JSON.parse(goal.routine || '{}');
  } catch {}
  return {
    ...routine,
    dailyMinutes: Number(routine.dailyMinutes) || 30,
    planVariant: routine.planVariant ?? 'steady',
  };
}

/** The logged `RoadmapWeek.testResult` as a line for the week writer, or null when none is stored in a usable shape. */
function loggedResult(testResult: unknown, testDayNote: string | undefined): string | null {
  if (!testResult || typeof testResult !== 'object' || Array.isArray(testResult)) return null;
  const { value, passed, unit, note } = testResult as Record<string, unknown>;
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '' || typeof passed !== 'boolean') return null;
  const amount = typeof unit === 'string' && unit.trim() ? `${String(value).trim()} ${unit.trim()}` : String(value).trim();
  const theirNote = typeof note === 'string' && note.trim() ? note.trim() : testDayNote;
  return `test logged: ${amount}, ${passed ? 'passed' : 'not passed'}${theirNote ? `; their note: "${theirNote}"` : ''}`;
}

/** B-61: the logged result first (the review's or a late test's), then the test day's notes. */
function lastWeekResult(testDay: DailyTask | undefined, testResult: unknown): string {
  const logged = loggedResult(testResult, testDay?.notes?.trim() || undefined);
  if (logged) return logged;
  if (!testDay) return 'no test day this week';
  if (testDay.status !== 'completed') return 'the weekly test was not done';
  return testDay.notes?.trim() ? `test done; their note: "${testDay.notes.trim()}"` : 'test done, score not logged';
}

/**
 * M3.1d (RULE-20, MR-32): what the finished week hands on, or null when there is nothing to hand on. Never throws: a
 * failure is logged and the week is written as without the switch, so the review never fails because of it.
 */
function readHandoff(
  finishedTasks: DailyTask[],
  weekBefore: DailyTask[],
  profile: RecoveryProfile,
  previous: RecoveryProfile | null
): { handoff: WeekHandoff; tasks: HandoffTask[] } | null {
  try {
    const parse = (task: DailyTask): HandoffTask => ({ ...task, steps: parseStoredSteps(task.detailedSteps) });
    const tasks = finishedTasks.map(parse);
    return { handoff: weekHandoff({ tasks, profile, previous, weekBefore: weekBefore.map(parse) }), tasks };
  } catch (err) {
    console.error('[PlanV2] Could not read what last week hands on:', err);
    return null;
  }
}

/**
 * M3.1d review: one line per kind whose carried steps wait inside the new week, with why (`no_session`: the writer
 * wrote no session of the kind; `sessions_full`; `only_step`), so production gives real numbers after switch-on.
 */
function logWaits(goalId: string, weekNumber: number, waiting: HandoffPlacement<WeekDayPlan>['waiting']) {
  const byKind = new Map<string, { why: string; count: number }>();
  for (const item of waiting) byKind.set(item.kind, { why: item.why, count: (byKind.get(item.kind)?.count ?? 0) + 1 });
  for (const [kind, { why, count }] of byKind) {
    console.info(`[Recovery] Handoff wait: goal ${goalId} week ${weekNumber} kind ${kind} waiting ${count} ${why}`);
  }
}

/**
 * Prompt 3 for the week after `finishedWeek`, from how that week went.
 * Until prompt 4 exists there is no coach's note and targets stay as planned.
 * With `METHOD_RECOVERY_ENABLED` on (M3.1d), the writer is also told where the person is, and code places the steps
 * last week hands on into the week the call returns. With it off, the call and the week are exactly as before.
 * Weekly update M1.5a: `firstWeekBack` (given only after a break, with `WEEK_CLOSE_ENABLED` on) tells the writer the days
 * away and the return rule's note; for a high-load goal code then puts the first-week-back line on its hard high-load
 * steps. Without it, the call and the week are exactly as before.
 */
export async function writeNextWeek(
  goal: Goal & { roadmapWeeks: RoadmapWeekRow[] },
  finishedWeek: number,
  finishedTasks: DailyTask[],
  slotTime: string,
  /** M2.1: the goal's profile; when not given it is read from the stored roadmap. Null: no kinds (RULE-18). */
  recovery?: RecoveryProfile | null,
  /** M3.1d review: the week before `finishedWeek`, only to see a break that started there. Read only with the switch on. */
  weekBefore: DailyTask[] = [],
  options: { firstWeekBack?: FirstWeekBack } = {}
): Promise<WeekDayPlan[] | null> {
  const stored = readStoredRoadmap(goal);
  const next = goal.roadmapWeeks.find((week) => week.weekNumber === finishedWeek + 1);
  const done = goal.roadmapWeeks.find((week) => week.weekNumber === finishedWeek);
  if (!stored || !next?.target || !next.test) return null;

  const routine = readRoutine(goal);
  // WU-13: a day not offered is not part of how the week went (never missed, no status effect).
  const practice = finishedTasks.filter((task) => !task.isRestDay && !task.notOffered);
  const phase = stored.phases.find((item) => item.name === next.phase) ?? { name: next.phase, purpose: '' };
  const profile = recovery === undefined ? readRecoveryProfile(goal.roadmap) : recovery;
  const handOn = methodRecoveryEnabled() && profile ? readHandoff(finishedTasks, weekBefore, profile, readRecoveryProfile(goal.roadmap) ?? profile) : null;
  const brief = handOn ? handoffBrief(handOn.handoff) : [];

  const days = await generateWeekPlan({
    finalGoal: stored.finalGoal,
    answers: stored.answers,
    dailyMinutes: routine.dailyMinutes,
    planVariant: routine.planVariant,
    slotTime,
    method: stored.method,
    weekNumber: next.weekNumber,
    totalWeeks: TOTAL_WEEKS,
    phase,
    focus: next.theme,
    target: next.target as unknown as WeekTarget,
    test: next.test as unknown as WeekTest,
    weekStart: weekStartFor(goal.startDate, next.weekNumber),
    highLoadGoal: isHighLoadGoal(goal),
    recovery: profile,
    lastWeek: done?.target
      ? {
          target: done.target as unknown as WeekTarget,
          result: lastWeekResult(finishedTasks.find((task) => task.isTestDay), done.testResult),
          done: practice.filter((task) => task.status === 'completed').length,
          planned: practice.length,
          keySessionsSkipped: practice
            // OD-2: a key session done only through the 10-minute version is not "key done" (M2.3).
            .filter((task) => task.isKeySession && (task.status !== 'completed' || task.usedMinimumVersion === true))
            .map((task) => `${task.dayOfWeek}: ${task.title}`),
        }
      : undefined,
    ...(brief.length > 0 ? { whereTheyAre: brief } : {}),
    ...(options.firstWeekBack ? { firstWeekBack: options.firstWeekBack } : {}),
  });
  if (!days) return days;
  // M1.5a review: the goal's load is worked out once (`goalLoad` in `writeWeekAfter`); the line acts only for a high-load goal.
  const back = options.firstWeekBack?.highLoad ? { everyStep: options.firstWeekBack.everyStep } : null;
  const placed = handOn && profile ? placeHandedOn(goal.id, next.weekNumber, days, handOn, profile, back) : days;
  if (!back) return placed;
  try {
    // WU-29 (1), WU-35 (2): after the call and the placement, so a carried step gets the line too. Never fails the week.
    return withFirstWeekBackLines(placed, profile, back.everyStep);
  } catch (err) {
    console.error('[PlanV2] Could not add the first-week-back line:', err);
    return placed;
  }
}

function placeHandedOn(
  goalId: string,
  weekNumber: number,
  days: WeekDayPlan[],
  handOn: NonNullable<ReturnType<typeof readHandoff>>,
  profile: RecoveryProfile,
  firstWeekBack: { everyStep: boolean } | null
) {
  try {
    const placement = placeHandoff({ days, handoff: handOn.handoff, profile, lastWeek: handOn.tasks, firstWeekBack });
    logWaits(goalId, weekNumber, placement.waiting);
    return placement.days;
  } catch (err) {
    // Never a new failure for the review: the week is kept as written.
    console.error('[PlanV2] Could not place what last week hands on:', err);
    return days;
  }
}

/** WU-33 (3): a week with no score (`null`, every day not offered) reports no benchmark (`benchmarkMet: null`). */
export function phaseGate(stored: StoredRoadmap, weekNumber: number, scorePercentage: number | null) {
  const index = stored.phases.findIndex((phase) => phase.endWeek === weekNumber);
  if (index < 0) return null;
  const phase = stored.phases[index];
  const nextPhase = stored.phases[index + 1];
  return {
    completedPhase: phase.name,
    nextPhase: nextPhase?.name ?? 'Graduated',
    title: nextPhase ? `${phase.name} complete` : 'Final week complete',
    benchmarkMet: scorePercentage === null ? null : scorePercentage >= 80,
  };
}

/**
 * Replaces a week's tasks. Delete and create run in one transaction, so a failure leaves the old week in place (B-13).
 * Given a caller's transaction (`tx`, weekly update M1.2a), they run inside it instead and commit with it.
 */
export async function saveWeekTasks(
  goalId: string,
  weekNumber: number,
  days: WeekDayPlan[],
  tx?: Prisma.TransactionClient,
  options: { notOfferedBefore?: string } = {}
) {
  const replace = async (client: Prisma.TransactionClient) => {
    await client.dailyTask.deleteMany({ where: { goalId, weekNumber } });
    await client.dailyTask.createMany({ data: dailyTaskRows(goalId, weekNumber, days, options.notOfferedBefore) });
  };
  if (tx) {
    await replace(tx);
    return tx.dailyTask.findMany({ where: { goalId, weekNumber }, orderBy: { dayNumber: 'asc' } });
  }
  await prisma.$transaction(replace);
  return prisma.dailyTask.findMany({ where: { goalId, weekNumber }, orderBy: { dayNumber: 'asc' } });
}
