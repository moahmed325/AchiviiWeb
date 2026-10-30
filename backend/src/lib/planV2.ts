import type { DailyTask, Goal, Prisma, RoadmapWeek as RoadmapWeekRow } from '@prisma/client';
import { prisma } from './prisma.js';
import { shapeOf } from './planLength.js';
import { type ChosenMethod, type Measure, type PlanAnswer, type Roadmap, type RoadmapPhase, type StartingPoint, type WeekTarget } from './ai/roadmap.js';
import {
  activeDaysFor,
  codeMadeTestStep,
  FEELS,
  generateWeekPlan,
  validRestWeekdays,
  weekLayout,
  type Feel,
  type LastWeekSummary,
  type PlanVariant,
  type WeekDayPlan,
} from './ai/weekPlan.js';
import { parseStoredSteps } from './carryForward.js';
import { isHighLoadGoal } from './highLoad.js';
import { loadGoalInput } from './safety/stepLoad.js';
import { baseWeekOf, firstWeekBackBaseOf, type BaseTask, type BaseWeek } from './safety/weekLoad.js';
import { FIRST_WEEK_BACK_LONG_BREAK_PERCENT } from './safety/limits.js';
import type { DetailedStep } from './ai/goalDecomposer.js';
import { handoffBrief, placeHandoff, weekHandoff, type HandoffPlacement, type HandoffTask, type WeekHandoff } from './recovery/handoff.js';
import { readRecoveryProfile, type RecoveryProfile } from './recovery/profile.js';
import { methodRecoveryEnabled } from './recovery/switch.js';
import { withFirstWeekBackLines } from './recovery/firstWeekBack.js';
import { LONG_BREAK_DAYS, type FirstWeekBack } from './weekClose/breaks.js';

/** What `Goal.roadmap` holds for a v2 goal. The 12 weeks live in `RoadmapWeek` rows. */
export interface StoredRoadmap {
  finalGoal: string;
  /** Goals made before the weekly tests went (2026-10-30); never read now. */
  finalTest?: string;
  startingPoint: StartingPoint;
  /** The one number that shows progress (`Roadmap.measure`); null or missing for a goal that is built or made. */
  measure?: Measure | null;
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
    // No weekly tests (2026-10-30): a week has its focus, no target or test (`target` and `test` stay empty).
    objective: week.focus,
    keyMilestone: '',
    targetIntensity: Math.round(60 + (40 * (week.weekNumber - 1)) / Math.max(1, roadmap.weeks.length - 1)),
    plannedMinutes: dailyMinutes * activeDaysFor(planVariant),
    status: week.weekNumber === 1 ? 'active' : 'pending',
  }));
}

/** `notOfferedBefore` (WU-13, M1.4): every row dated before this local date ('YYYY-MM-DD') is stored not offered. */
/**
 * A written day's id, given before it is saved (`WeekDayPlan.taskId`): the goal's id and the day of the plan. Unique
 * (one row per goal and day) and the same every time the week is written, so a retried write names the same days.
 */
export function dayTaskId(goalId: string, weekNumber: number, dayOfWeek: number): string {
  return `${goalId}-d${(weekNumber - 1) * 7 + dayOfWeek}`;
}

export function dailyTaskRows(goalId: string, weekNumber: number, days: WeekDayPlan[], notOfferedBefore?: string) {
  return days.map((day) => ({
    ...(day.taskId ? { id: day.taskId } : {}),
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
  /** Edit my schedule (B-108): the chosen rest weekdays (0 Sunday to 6 Saturday), kept only when valid for the variant. */
  restWeekdays?: number[];
}

/** B-103: the stored routine as a plain object, or {} when it is missing or not JSON. The one place it is parsed. */
export function routineRecord(goal: Pick<Goal, 'routine'>): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(goal.routine || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const PLAN_VARIANTS: readonly PlanVariant[] = ['steady', 'accelerated', 'minimal'];
/** The daily minutes goal create and the schedule edit accept (B-108: one range for both). */
export const DAILY_MINUTES_MIN = 10;
export const DAILY_MINUTES_MAX = 480;
export const PREFERRED_SLOTS = ['morning', 'afternoon', 'evening'] as const;

/**
 * Edit my schedule (B-108, code review): the schedule in force, as the week writer will use it, for the app: the
 * variant, the minutes, the time of day (anything but morning or afternoon is evening, as `slotTimeFor` reads it) and
 * the rest weekdays (the chosen ones, or the variant's own from the plan's week start, read off `weekLayout`).
 */
export interface GoalSchedule {
  planVariant: PlanVariant;
  dailyMinutes: number;
  preferredSlot: (typeof PREFERRED_SLOTS)[number];
  restWeekdays: number[];
  /** The rest days were chosen; false means they follow the variant's own positions. */
  restWeekdaysChosen: boolean;
}

export function goalScheduleOf(goal: Pick<Goal, 'routine' | 'startDate'>): GoalSchedule {
  const routine = readRoutine(goal);
  const slot = routine.preferredSlot === 'morning' || routine.preferredSlot === 'afternoon' ? routine.preferredSlot : 'evening';
  const restWeekdays = weekLayout(routine.planVariant, new Date(goal.startDate), routine.restWeekdays)
    .filter((day) => day.isRestDay)
    .map((day) => new Date(`${day.date}T00:00:00Z`).getUTCDay())
    .sort((a, b) => a - b);
  return { planVariant: routine.planVariant, dailyMinutes: routine.dailyMinutes, preferredSlot: slot, restWeekdays, restWeekdaysChosen: Boolean(routine.restWeekdays) };
}

/** The stored routine, checked field by field (B-103): a field of the wrong type is left out, so its default applies. */
export function readRoutine(goal: Pick<Goal, 'routine'>): Required<Pick<RoutineShape, 'dailyMinutes' | 'planVariant'>> & RoutineShape {
  const raw = routineRecord(goal);
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
  const variant = PLAN_VARIANTS.find((item) => item === raw.planVariant) ?? 'steady';
  const restWeekdays = validRestWeekdays(variant, raw.restWeekdays);
  return {
    ...(text(raw.preferredSlot) ? { preferredSlot: text(raw.preferredSlot) } : {}),
    ...(text(raw.sleepTime) ? { sleepTime: text(raw.sleepTime) } : {}),
    dailyMinutes: Number(raw.dailyMinutes) || 30,
    planVariant: variant,
    ...(restWeekdays ? { restWeekdays } : {}),
  };
}

/** B-103: the roadmap's starting point as a number, or null (none, or a deliverable goal). */
export function startingPointValue(goal: { roadmap?: unknown }): number | null {
  const roadmap = goal.roadmap as { startingPoint?: { value?: unknown } } | null;
  return typeof roadmap?.startingPoint?.value === 'number' ? roadmap.startingPoint.value : null;
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
 * Weekly update M3.1 (RULE-9, WU-45): after an accepted update the goal comes with the new targets and `coachNote` is
 * the update's `guidanceForNextWeek`, told as "Coach's note"; without it the call is exactly as before.
 * With `METHOD_RECOVERY_ENABLED` on (M3.1d), the writer is also told where the person is, and code places the steps
 * last week hands on into the week the call returns. With it off, the call and the week are exactly as before.
 * Weekly update M1.5a: `firstWeekBack` (given only after a break, with `WEEK_CLOSE_ENABLED` on) tells the writer the days
 * away and the return rule's note; for a high-load goal code then puts the first-week-back line on its hard high-load
 * steps. Without it, the call and the week are exactly as before.
 * Weekly update M1.5b: `weekNumber` names the week to write when a jump past the limit skips the weeks in between (the
 * first week back); `finishedWeek` stays the week that closed, so last week's result and the handoff read it. Without
 * it the week written is `finishedWeek + 1`, as before.
 * Plan safety limits M2.2b (RULE-7, PSL-18): on a load goal with `firstWeekBack`, the base week is the newest week with
 * done running, read from `finishedTasks` then `olderWeeks` (the goal's weeks before `finishedWeek`, read by
 * `writeWeekAfter`), held with no allowance. Without `firstWeekBack` the base is the closing week, as before.
 * Weekly update M3.3a (RULE-5, RULE-6, WU-56): `retest`, the closing week's test; code puts the re-test step first on
 * the new week's first offered practice day before the test day.
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
  options: { firstWeekBack?: FirstWeekBack; weekNumber?: number; olderWeeks?: DailyTask[]; reflection?: string } = {}
): Promise<WeekDayPlan[] | null> {
  const stored = readStoredRoadmap(goal);
  const next = goal.roadmapWeeks.find((week) => week.weekNumber === (options.weekNumber ?? finishedWeek + 1));
  if (!stored || !next) return null;

  const routine = readRoutine(goal);
  const phase = stored.phases.find((item) => item.name === next.phase) ?? { name: next.phase, purpose: '' };
  const profile = recovery === undefined ? readRecoveryProfile(goal.roadmap) : recovery;
  const handOn = methodRecoveryEnabled() && profile ? readHandoff(finishedTasks, weekBefore, profile, readRecoveryProfile(goal.roadmap) ?? profile) : null;
  const brief = handOn ? handoffBrief(handOn.handoff) : [];

  const load = loadGoalInput(goal, measureTarget(stored, next), startingPointValue(goal));
  const lastWeek = finishedWeek >= 1 && finishedTasks.length > 0 ? lastWeekOf(finishedTasks, options.reflection) : null;
  const days = await generateWeekPlan({
    finalGoal: stored.finalGoal,
    answers: stored.answers,
    dailyMinutes: routine.dailyMinutes,
    planVariant: routine.planVariant,
    ...(routine.restWeekdays ? { restWeekdays: routine.restWeekdays } : {}),
    slotTime,
    method: stored.method,
    weekNumber: next.weekNumber,
    totalWeeks: shapeOf(goal).weeks,
    phase,
    focus: next.theme,
    weekStart: weekStartFor(goal.startDate, next.weekNumber),
    highLoadGoal: isHighLoadGoal(goal),
    // Plan safety limits M2.1 (RULE-4): only a load goal adds the key, so any other goal's call is exactly as before.
    // M2.2a (RULE-5, B-64): a load goal also gets the closing week as its base week; M2.2b (RULE-7): a first week back
    // gets the newest week with done running instead.
    ...load,
    ...(load.loadGoal
      ? {
          baseWeek: options.firstWeekBack
            ? firstWeekBackBaseFrom(finishedWeek, finishedTasks, options.olderWeeks ?? [], load.loadGoal.running, options.firstWeekBack.awayDays)
            : baseWeekFrom(finishedTasks, load.loadGoal.running),
        }
      : {}),
    // B-64: for the `[Safety]` lines.
    goalId: goal.id,
    recovery: profile,
    ...(lastWeek ? { lastWeek } : {}),
    ...(brief.length > 0 ? { whereTheyAre: brief } : {}),
    ...(options.firstWeekBack ? { firstWeekBack: options.firstWeekBack } : {}),
  });
  if (!days) return days;
  // M1.5a review: the goal's load is worked out once (`goalLoad` in `writeWeekAfter`); the line acts only for a high-load goal.
  const back = options.firstWeekBack?.highLoad ? { everyStep: options.firstWeekBack.everyStep } : null;
  // Each day's id is known before placement, so a step code moves within the new week keeps the day it was written on.
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

/** M2.2a (PSL-11 Q8, PSL-15 (1)): the closing week's running, planned and done, from its stored rows. */
function baseWeekFrom(tasks: DailyTask[], running: boolean): BaseWeek {
  return baseWeekOf(baseTasks(tasks), running, codeMadeTestStep);
}

/**
 * M2.2b (PSL-18 (3), (6)): walks back from the closing week through the older weeks' rows (any order); half of the done
 * total after a break of `LONG_BREAK_DAYS` or more.
 */
function firstWeekBackBaseFrom(finishedWeek: number, finishedTasks: DailyTask[], olderWeeks: DailyTask[], running: boolean, awayDays: number): BaseWeek {
  const byWeek = new Map<number, DailyTask[]>();
  for (const task of olderWeeks) if (task.weekNumber < finishedWeek) byWeek.set(task.weekNumber, [...(byWeek.get(task.weekNumber) ?? []), task]);
  const weeks = [{ weekNumber: finishedWeek, tasks: baseTasks(finishedTasks) }];
  for (const weekNumber of [...byWeek.keys()].sort((a, b) => b - a)) weeks.push({ weekNumber, tasks: baseTasks(byWeek.get(weekNumber) ?? []) });
  const percent = awayDays >= LONG_BREAK_DAYS ? FIRST_WEEK_BACK_LONG_BREAK_PERCENT : 100;
  return firstWeekBackBaseOf(weeks, running, codeMadeTestStep, percent);
}

function baseTasks(tasks: DailyTask[]): BaseTask[] {
  return tasks.map((task) => ({
    id: task.id,
    date: task.date,
    status: task.status,
    isTestDay: task.isTestDay,
    notOffered: task.notOffered,
    usedMinimumVersion: task.usedMinimumVersion,
    steps: parseStoredSteps(task.detailedSteps),
    minimumVersion: task.minimumVersion && typeof task.minimumVersion === 'object' && !Array.isArray(task.minimumVersion) ? (task.minimumVersion as unknown as DetailedStep) : null,
  }));
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
    // Each day's id is known before placement, so a step code moves within the new week keeps the day it was written on.
    const withIds = days.map((day) => ({ ...day, taskId: dayTaskId(goalId, weekNumber, day.dayNumber) }));
    const placement = placeHandoff({ days: withIds, handoff: handOn.handoff, profile, lastWeek: handOn.tasks, firstWeekBack });
    logWaits(goalId, weekNumber, placement.waiting);
    // The ids given before placement are kept only when a bumped step names its day by one; otherwise the week is saved
    // exactly as before (the database gives the ids).
    return placement.bumped > 0 ? placement.days : placement.days.map(({ taskId: _id, ...day }) => day as WeekDayPlan);
  } catch (err) {
    // Never a new failure for the review: the week is kept as written.
    console.error('[PlanV2] Could not place what last week hands on:', err);
    return days;
  }
}

/** A stored tap, or null for none or anything else. */
export function readFeel(value: unknown): Feel | null {
  return typeof value === 'string' && (FEELS as readonly string[]).includes(value) ? (value as Feel) : null;
}

/**
 * No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md section 7): the finished week as the next week is
 * written from it. WU-13: a day not offered is not part of how the week went. The taps count done sessions only; each
 * note keeps its day ("Tuesday: my knee hurt").
 */
export function lastWeekOf(tasks: readonly DailyTask[], reflection?: string): LastWeekSummary {
  const practice = tasks.filter((task) => !task.isRestDay && !task.notOffered);
  const done = practice.filter((task) => task.status === 'completed');
  const feel: Record<Feel, number> = { too_easy: 0, just_right: 0, too_hard: 0 };
  for (const task of done) {
    const tapped = readFeel((task as DailyTask & { feel?: unknown }).feel);
    if (tapped) feel[tapped] += 1;
  }
  const notes = tasks.flatMap((task) => (task.notes?.trim() ? [`${task.dayOfWeek}: ${task.notes.trim()}`] : []));
  return {
    done: done.length,
    planned: practice.length,
    // OD-2: a key session done only through the 10-minute version is not "key done" (M2.3).
    keySessionsSkipped: practice
      .filter((task) => task.isKeySession && (task.status !== 'completed' || task.usedMinimumVersion === true))
      .map((task) => `${task.dayOfWeek}: ${task.title}`),
    feel,
    notes,
    ...(reflection?.trim() ? { reflection: reflection.trim() } : {}),
  };
}

/**
 * The safety limits' reading of the goal (`loadGoalFor`): its measure with today's level, as a number target. A goal
 * made before the weekly tests went has no measure; its week's stored target is read instead. Null for a goal that is
 * built or made.
 */
export function measureTarget(stored: Pick<StoredRoadmap, 'measure' | 'startingPoint'>, week: Pick<RoadmapWeekRow, 'target'> | undefined): WeekTarget | null {
  const measure = stored.measure;
  if (measure) {
    const value = typeof stored.startingPoint?.value === 'number' ? stored.startingPoint.value : 0;
    return { kind: 'number', metric: measure.metric, unit: measure.unit, direction: measure.direction, value };
  }
  const target = week?.target as WeekTarget | null | undefined;
  return target && typeof target === 'object' && target.kind === 'number' && typeof target.value === 'number' ? target : null;
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
