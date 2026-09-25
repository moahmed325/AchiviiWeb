import { useMemo } from 'react';
import type { DailyTask, Goal, RoadmapPhase, RoadmapWeek } from '../types';
import type {
  JourneyClosingStretch,
  JourneyData,
  JourneyPhase,
  JourneyProgressMetrics,
  JourneyStatus,
  JourneyStep,
  JourneyWeek,
} from '../types/journey';
import { useGoal } from '../context/GoalContext';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Default fixed phases for v1 goals (Foundation, Acceleration, Mastery).
 */
export const V1_DEFAULT_PHASES: RoadmapPhase[] = [
  { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Establish baseline habits and foundational skills' },
  { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Increase volume, intensity, and progressive overload' },
  { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak performance, integration, and final testing' },
];

/**
 * Calculates current calendar day (1–90) from goal dates.
 * Uses targetDate (91 - daysRemaining) clamped to [1, 90].
 * Falls back to startDate or created_at if targetDate is missing.
 */
export function calculateDayNumber(
  goal: Partial<Pick<Goal, 'targetDate' | 'startDate' | 'created_at'>>,
  now: Date
): number {
  if (goal.targetDate) {
    const targetTime = new Date(goal.targetDate).getTime();
    if (!isNaN(targetTime)) {
      const daysRemaining = Math.max(0, Math.ceil((targetTime - now.getTime()) / DAY_MS));
      return Math.min(90, Math.max(1, 91 - daysRemaining));
    }
  }

  const startStr = goal.startDate || goal.created_at;
  if (startStr) {
    const startTime = new Date(startStr).getTime();
    if (!isNaN(startTime)) {
      const elapsedDays = Math.floor((now.getTime() - startTime) / DAY_MS) + 1;
      return Math.min(90, Math.max(1, elapsedDays));
    }
  }

  return 1;
}

/**
 * Maps a single DailyTask into a JourneyStep.
 */
export function mapTaskToStep(task: DailyTask, currentDay: number, todayStr: string): JourneyStep {
  let status: JourneyStatus;

  if (task.status === 'completed' || task.status === 'skipped') {
    status = 'completed';
  } else {
    // pending task
    const isToday = task.date === todayStr || task.dayNumber === currentDay;
    if (isToday || task.dayNumber < currentDay) {
      status = 'active';
    } else {
      status = 'upcoming';
    }
  }

  return {
    dayNumber: task.dayNumber,
    dayOfWeek: task.dayOfWeek,
    title: task.title,
    durationMinutes: task.durationMinutes,
    status,
    isRestDay: Boolean(task.isRestDay),
    isKeySession: Boolean(task.isKeySession),
    isTestDay: Boolean(task.isTestDay),
    whyToday: task.whyToday || null,
    taskId: task.id,
  };
}

/**
 * Pure normalization function that transforms any Goal (v1 or v2)
 * into the canonical JourneyData model.
 *
 * @param goal Active goal to normalize
 * @param todayDate Optional reference date (defaults to new Date())
 * @returns Canonical JourneyData model, or null if goal is null/undefined
 */
export function toJourneyData(goal: Goal | null | undefined, todayDate?: Date | string): JourneyData | null {
  if (!goal) return null;

  const parsedDate = todayDate ? (typeof todayDate === 'string' ? new Date(todayDate) : todayDate) : new Date();
  const now = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const todayStr = now.toISOString().split('T')[0];

  const currentDay = calculateDayNumber(goal, now);
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));

  const isV2 = Boolean(goal.planVersion === 2 && goal.roadmap);

  // Phase count flexibility (OD-7):
  // v2 goals have 2-4 method-named phases; v1 goals have 3 fixed phases
  const rawPhases: RoadmapPhase[] =
    isV2 && goal.roadmap?.phases && goal.roadmap.phases.length >= 2
      ? goal.roadmap.phases
      : V1_DEFAULT_PHASES;

  const allRoadmapWeeks: RoadmapWeek[] =
    (goal.roadmap && (goal.roadmap as unknown as { weeks?: RoadmapWeek[] }).weeks) || goal.roadmapWeeks || [];
  const allDailyTasks: DailyTask[] =
    goal.dailyTasks || (goal as unknown as { tasks?: DailyTask[] }).tasks || [];

  const phases: JourneyPhase[] = rawPhases.map((p, index) => {
    const phaseId = `p${index + 1}`;
    const phaseIndex = index + 1;
    const weeksLabel =
      p.startWeek === p.endWeek ? `Week ${p.startWeek}` : `Weeks ${p.startWeek}–${p.endWeek}`;

    let phaseStatus: JourneyStatus;
    if (goal.status === 'completed' || currentDay >= 85 || currentWeek > p.endWeek) {
      phaseStatus = 'completed';
    } else if (currentWeek >= p.startWeek && currentWeek <= p.endWeek) {
      phaseStatus = 'active';
    } else {
      phaseStatus = 'upcoming';
    }

    const weeks: JourneyWeek[] = [];
    for (let wNum = p.startWeek; wNum <= p.endWeek; wNum++) {
      const matchingWeek = allRoadmapWeeks.find((rw) => rw.weekNumber === wNum);
      const isCurrentWeek = wNum === currentWeek;

      let weekStatus: JourneyStatus;
      if (goal.status === 'completed' || currentDay >= 85 || wNum < currentWeek) {
        weekStatus = 'completed';
      } else if (wNum === currentWeek) {
        weekStatus = 'active';
      } else {
        weekStatus = 'upcoming';
      }

      // Future Honesty (BP §43):
      // For v2 goals, daily tasks exist ONLY for currentWeek.
      // Future weeks must have empty days: [] and hasWrittenTasks: false.
      let days: JourneyStep[];
      let hasWrittenTasks: boolean;

      if (isCurrentWeek) {
        const weekTasks = allDailyTasks.filter((t) => t.weekNumber === wNum);
        weekTasks.sort((a, b) => a.dayNumber - b.dayNumber);
        days = weekTasks.map((t) => mapTaskToStep(t, currentDay, todayStr));
        hasWrittenTasks = days.length > 0;
      } else {
        days = [];
        hasWrittenTasks = false;
      }

      const weekTheme = matchingWeek?.theme || (matchingWeek as unknown as { focus?: string })?.focus;
      const weekFocus = (matchingWeek as unknown as { focus?: string })?.focus || matchingWeek?.theme;

      weeks.push({
        weekNumber: wNum,
        title: weekTheme || matchingWeek?.objective || `Week ${wNum}`,
        phaseId,
        phaseName: p.name,
        theme: weekTheme,
        focus: weekFocus,
        target: matchingWeek?.target || null,
        test: matchingWeek?.test || null,
        keyMilestone: matchingWeek?.keyMilestone,
        status: weekStatus,
        executionScore: matchingWeek?.executionScore,
        days,
        isCurrentWeek,
        hasWrittenTasks,
      });
    }

    return {
      id: phaseId,
      index: phaseIndex,
      name: p.name,
      purpose: p.purpose || '',
      startWeek: p.startWeek,
      endWeek: p.endWeek,
      weeksLabel,
      status: phaseStatus,
      weeks,
    };
  });

  // Closing Stretch (OD-2 Option A): Days 85-90 dedicated to final test, reflection & arrival
  const isClosingStretchActive = currentDay >= 85 && goal.status !== 'completed';
  const isClosingStretchCompleted = goal.status === 'completed';

  let closingStretchStatus: JourneyStatus;
  if (isClosingStretchCompleted) {
    closingStretchStatus = 'completed';
  } else if (isClosingStretchActive) {
    closingStretchStatus = 'active';
  } else {
    closingStretchStatus = 'upcoming';
  }

  const closingStretch: JourneyClosingStretch = {
    startDay: 85,
    endDay: 90,
    finalTest: goal.roadmap?.finalTest || 'Complete your 90-day final evaluation',
    finalGoal: goal.roadmap?.finalGoal || goal.clarifiedOutcome || goal.rawGoal,
    status: closingStretchStatus,
    isCurrent: isClosingStretchActive,
  };

  // High-level progress metrics (VDS §9 Layer 1)
  const activePhase =
    phases.find((phase) => currentWeek >= phase.startWeek && currentWeek <= phase.endWeek) ||
    phases[phases.length - 1];
  const currentPhaseIndex = activePhase ? activePhase.index : 1;
  const completedTasksCount = allDailyTasks.filter((t) => t.status === 'completed').length;

  let percentComplete: number;
  if (goal.status === 'completed') {
    percentComplete = 100;
  } else if (allDailyTasks.length > 0) {
    percentComplete = Math.min(100, Math.max(0, Math.round((completedTasksCount / allDailyTasks.length) * 100)));
  } else {
    percentComplete = Math.min(100, Math.max(0, Math.round((currentDay / 90) * 100)));
  }

  const metrics: JourneyProgressMetrics = {
    currentDay,
    totalDays: 90,
    currentWeek,
    totalWeeks: 12,
    currentPhaseIndex,
    totalPhases: phases.length,
    completedTasksCount,
    percentComplete,
  };

  return {
    goalId: goal.id,
    rawGoal: goal.rawGoal,
    clarifiedOutcome: goal.clarifiedOutcome || goal.rawGoal,
    finalGoal: goal.roadmap?.finalGoal || goal.clarifiedOutcome || goal.rawGoal,
    finalTest: goal.roadmap?.finalTest || undefined,
    methodName: goal.roadmap?.method?.name || goal.canonicalMethodName || undefined,
    methodAuthor: goal.roadmap?.method?.creator || goal.canonicalAuthority || undefined,
    planVersion: goal.planVersion === 2 ? 2 : 1,
    phases,
    closingStretch,
    metrics,
  };
}

/**
 * Custom React hook that consumes activeGoal from GoalContext
 * and memoizes the canonical JourneyData shape.
 */
export function useJourneyData(todayDate?: Date | string): JourneyData | null {
  const { activeGoal } = useGoal();
  return useMemo(() => {
    return toJourneyData(activeGoal, todayDate);
  }, [activeGoal, todayDate]);
}
