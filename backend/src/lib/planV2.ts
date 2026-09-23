import type { DailyTask, Goal, RoadmapWeek as RoadmapWeekRow } from '@prisma/client';
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

/** What `Goal.roadmap` holds for a v2 goal. The 12 weeks live in `RoadmapWeek` rows. */
export interface StoredRoadmap {
  finalGoal: string;
  finalTest: string;
  startingPoint: StartingPoint;
  method: ChosenMethod;
  phases: RoadmapPhase[];
  answers: PlanAnswer[];
}

export function storedRoadmap(roadmap: Roadmap, answers: PlanAnswer[]): StoredRoadmap {
  const { weeks: _weeks, ...rest } = roadmap;
  return { ...rest, answers };
}

function json<T>(value: T) {
  return JSON.parse(JSON.stringify(value));
}

export function weekStartFor(goalStart: Date, weekNumber: number): Date {
  const start = new Date(goalStart);
  start.setDate(start.getDate() + (weekNumber - 1) * 7);
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

export function dailyTaskRows(goalId: string, weekNumber: number, days: WeekDayPlan[]) {
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

function lastWeekResult(testDay: DailyTask | undefined): string {
  if (!testDay) return 'no test day this week';
  if (testDay.status !== 'completed') return 'the weekly test was not done';
  return testDay.notes?.trim() ? `test done; their note: "${testDay.notes.trim()}"` : 'test done, score not logged';
}

/**
 * Prompt 3 for the week after `finishedWeek`, from how that week went.
 * Until prompt 4 exists there is no coach's note and targets stay as planned.
 */
export async function writeNextWeek(
  goal: Goal & { roadmapWeeks: RoadmapWeekRow[] },
  finishedWeek: number,
  finishedTasks: DailyTask[],
  slotTime: string
): Promise<WeekDayPlan[] | null> {
  const stored = readStoredRoadmap(goal);
  const next = goal.roadmapWeeks.find((week) => week.weekNumber === finishedWeek + 1);
  const done = goal.roadmapWeeks.find((week) => week.weekNumber === finishedWeek);
  if (!stored || !next?.target || !next.test) return null;

  const routine = readRoutine(goal);
  const practice = finishedTasks.filter((task) => !task.isRestDay);
  const phase = stored.phases.find((item) => item.name === next.phase) ?? { name: next.phase, purpose: '' };

  return generateWeekPlan({
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
    lastWeek: done?.target
      ? {
          target: done.target as unknown as WeekTarget,
          result: lastWeekResult(finishedTasks.find((task) => task.isTestDay)),
          done: practice.filter((task) => task.status === 'completed').length,
          planned: practice.length,
          keySessionsSkipped: practice
            .filter((task) => task.isKeySession && task.status !== 'completed')
            .map((task) => `${task.dayOfWeek}: ${task.title}`),
        }
      : undefined,
  });
}

export function phaseGate(stored: StoredRoadmap, weekNumber: number, scorePercentage: number) {
  const index = stored.phases.findIndex((phase) => phase.endWeek === weekNumber);
  if (index < 0) return null;
  const phase = stored.phases[index];
  const nextPhase = stored.phases[index + 1];
  return {
    completedPhase: phase.name,
    nextPhase: nextPhase?.name ?? 'Graduated',
    title: nextPhase ? `${phase.name} complete` : 'Final week complete',
    benchmarkMet: scorePercentage >= 80,
  };
}

export async function saveWeekTasks(goalId: string, weekNumber: number, days: WeekDayPlan[]) {
  await prisma.dailyTask.deleteMany({ where: { goalId, weekNumber } });
  await prisma.dailyTask.createMany({ data: dailyTaskRows(goalId, weekNumber, days) });
  return prisma.dailyTask.findMany({ where: { goalId, weekNumber }, orderBy: { dayNumber: 'asc' } });
}
