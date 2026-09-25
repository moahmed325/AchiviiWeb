import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  toJourneyData,
  calculateDayNumber,
  mapTaskToStep,
  V1_DEFAULT_PHASES,
  useJourneyData,
} from './journeyAdapter';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../types';
import { useGoal } from '../context/GoalContext';

vi.mock('../context/GoalContext', () => ({
  useGoal: vi.fn(),
}));

describe('journeyAdapter', () => {
  const baseGoal: Goal = {
    id: 'goal-test-1',
    userId: 'user-test-1',
    rawGoal: 'Run a 10K in 50 Minutes',
    clarifiedOutcome: 'Run 10 kilometers in under 50 minutes',
    methodologyNotes: 'Jack Daniels Running Formula',
    status: 'active',
    startDate: '2026-09-01T00:00:00.000Z',
    targetDate: '2026-11-30T00:00:00.000Z',
    currentWeek: 3,
    answers: '{}',
    routine: '{}',
    planVersion: 2,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const createMockTasks = (weekNumber: number): DailyTask[] => [
    {
      id: `task-${weekNumber}-1`,
      goalId: 'goal-test-1',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 1,
      date: '2026-09-15',
      dayOfWeek: 'Monday',
      title: 'Easy Aerobic Base Run',
      detailedSteps: '[]',
      implementationIntention: 'When morning arrives | Where park | Action run',
      durationMinutes: 45,
      isRestDay: false,
      status: 'completed',
      created_at: '2026-09-01',
    },
    {
      id: `task-${weekNumber}-2`,
      goalId: 'goal-test-1',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 2,
      date: '2026-09-16',
      dayOfWeek: 'Tuesday',
      title: 'Cadence Drills',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: false,
      status: 'pending',
      created_at: '2026-09-01',
    },
    {
      id: `task-${weekNumber}-3`,
      goalId: 'goal-test-1',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 3,
      date: '2026-09-17',
      dayOfWeek: 'Wednesday',
      title: 'Rest & Active Recovery',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 0,
      isRestDay: true,
      status: 'pending',
      created_at: '2026-09-01',
    },
  ];

  describe('R1: Null Handling & Core Normalization', () => {
    it('returns null when goal is null or undefined', () => {
      expect(toJourneyData(null)).toBeNull();
      expect(toJourneyData(undefined)).toBeNull();
    });

    it('derives correct top-level identity fields and planVersion', () => {
      const result = toJourneyData(baseGoal);
      expect(result).not.toBeNull();
      expect(result?.goalId).toBe('goal-test-1');
      expect(result?.rawGoal).toBe('Run a 10K in 50 Minutes');
      expect(result?.clarifiedOutcome).toBe('Run 10 kilometers in under 50 minutes');
      expect(result?.planVersion).toBe(2);
    });

    it('computes 90-day progress metrics accurately', () => {
      const goalWithTasks: Goal = {
        ...baseGoal,
        currentWeek: 3,
        dailyTasks: createMockTasks(3),
      };

      const result = toJourneyData(goalWithTasks, '2026-09-15');
      expect(result).not.toBeNull();
      expect(result?.metrics.totalDays).toBe(90);
      expect(result?.metrics.totalWeeks).toBe(12);
      expect(result?.metrics.currentWeek).toBe(3);
      expect(result?.metrics.completedTasksCount).toBe(1);
      // 1 completed of 3 tasks = 33%
      expect(result?.metrics.percentComplete).toBe(33);
    });
  });

  describe('R2 & OD-7: Phase Count Flexibility (2, 3, and 4 Phases)', () => {
    it('supports v2 goals with 2 phases (e.g. 6 weeks + 6 weeks)', () => {
      const roadmap2Phases: GoalRoadmap = {
        finalGoal: 'Sub-50 10K',
        finalTest: 'Run 10K time trial in under 50 minutes',
        startingPoint: { value: 65, description: 'Current 10K: 65 mins' },
        method: {
          name: 'Two-Stage Periodization',
          creator: 'Coach Daniels',
          summary: 'Aerobic base followed by threshold specificity',
          whyChosen: 'Optimal for beginner-to-intermediate transitions',
          runnerUp: null,
          safety: 5,
          rules: ['No back-to-back hard days'],
        },
        phases: [
          { name: 'Aerobic Foundation', startWeek: 1, endWeek: 6, purpose: 'Build aerobic capacity' },
          { name: 'Threshold Speed', startWeek: 7, endWeek: 12, purpose: 'Lactate threshold development' },
        ],
      };

      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap2Phases,
        currentWeek: 4,
      };

      const result = toJourneyData(goal);
      expect(result).not.toBeNull();
      expect(result?.phases).toHaveLength(2);
      expect(result?.phases[0].id).toBe('p1');
      expect(result?.phases[0].name).toBe('Aerobic Foundation');
      expect(result?.phases[0].weeksLabel).toBe('Weeks 1–6');
      expect(result?.phases[0].status).toBe('active');
      expect(result?.phases[0].weeks).toHaveLength(6);

      expect(result?.phases[1].id).toBe('p2');
      expect(result?.phases[1].name).toBe('Threshold Speed');
      expect(result?.phases[1].weeksLabel).toBe('Weeks 7–12');
      expect(result?.phases[1].status).toBe('upcoming');
      expect(result?.phases[1].weeks).toHaveLength(6);

      expect(result?.metrics.totalPhases).toBe(2);
      expect(result?.metrics.currentPhaseIndex).toBe(1);
    });

    it('supports v2 goals with 3 phases (e.g. 4 + 4 + 4)', () => {
      const roadmap3Phases: GoalRoadmap = {
        finalGoal: 'Sub-50 10K',
        finalTest: 'Run 10K in 49:59',
        startingPoint: { value: 60, description: 'Base 60 mins' },
        method: {
          name: 'Classic 3-Phase Method',
          creator: 'Lydiard',
          summary: 'Base, Hills, Sharpening',
          whyChosen: 'Proven endurance methodology',
          runnerUp: null,
          safety: 4,
          rules: ['Strict recovery'],
        },
        phases: [
          { name: 'Aerobic Foundation', startWeek: 1, endWeek: 4, purpose: 'Build base' },
          { name: 'Anaerobic Development', startWeek: 5, endWeek: 8, purpose: 'Threshold build' },
          { name: 'Coordination & Taper', startWeek: 9, endWeek: 12, purpose: 'Peak racing condition' },
        ],
      };

      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        currentWeek: 6,
      };

      const result = toJourneyData(goal);
      expect(result?.phases).toHaveLength(3);
      expect(result?.phases[0].status).toBe('completed');
      expect(result?.phases[1].status).toBe('active');
      expect(result?.phases[2].status).toBe('upcoming');
      expect(result?.metrics.currentPhaseIndex).toBe(2);
      expect(result?.metrics.totalPhases).toBe(3);
    });

    it('supports v2 goals with 4 phases (e.g. 3 + 3 + 3 + 3)', () => {
      const roadmap4Phases: GoalRoadmap = {
        finalGoal: 'Complete B2 French',
        finalTest: 'Pass DELF B2 Exam',
        startingPoint: { value: 1, description: 'A2 level' },
        method: {
          name: 'CEFR Quad-Step',
          creator: 'Alliance Française',
          summary: 'Four incremental linguistic stages',
          whyChosen: 'Structured academic framework',
          runnerUp: null,
          safety: 5,
          rules: ['Speak daily'],
        },
        phases: [
          { name: 'Foundations & Grammar', startWeek: 1, endWeek: 3, purpose: 'Syntax mastery' },
          { name: 'Comprehension & Vocabulary', startWeek: 4, endWeek: 6, purpose: 'Listening immersion' },
          { name: 'Oral Production', startWeek: 7, endWeek: 9, purpose: 'Conversational fluency' },
          { name: 'Exam Synthesis', startWeek: 10, endWeek: 12, purpose: 'Mock exams' },
        ],
      };

      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap4Phases,
        currentWeek: 11,
      };

      const result = toJourneyData(goal);
      expect(result?.phases).toHaveLength(4);
      expect(result?.phases[0].status).toBe('completed');
      expect(result?.phases[1].status).toBe('completed');
      expect(result?.phases[2].status).toBe('completed');
      expect(result?.phases[3].status).toBe('active');
      expect(result?.metrics.currentPhaseIndex).toBe(4);
      expect(result?.metrics.totalPhases).toBe(4);
    });

    it('supports v1 goals with legacy fixed 3 phases and roadmapWeeks', () => {
      const mockRoadmapWeeks: RoadmapWeek[] = Array.from({ length: 12 }, (_, i) => ({
        id: `rw-${i + 1}`,
        goalId: 'goal-v1',
        weekNumber: i + 1,
        phase: i < 4 ? 'Foundation' : i < 8 ? 'Acceleration' : 'Mastery',
        theme: `Week ${i + 1} Focus`,
        objective: `Run ${20 + i * 2} km total`,
        keyMilestone: `Complete 1 long run`,
        targetIntensity: 70,
        plannedMinutes: 180,
        status: i + 1 < 5 ? 'completed' : i + 1 === 5 ? 'active' : 'pending',
        created_at: '2026-09-01',
      }));

      const v1Goal: Goal = {
        ...baseGoal,
        planVersion: 1,
        roadmap: null,
        currentWeek: 5,
        roadmapWeeks: mockRoadmapWeeks,
        dailyTasks: createMockTasks(5),
      };

      const result = toJourneyData(v1Goal);
      expect(result).not.toBeNull();
      expect(result?.planVersion).toBe(1);
      expect(result?.phases).toHaveLength(3);
      expect(result?.phases[0].name).toBe('Foundation');
      expect(result?.phases[1].name).toBe('Acceleration');
      expect(result?.phases[2].name).toBe('Mastery');
      expect(result?.phases[0].status).toBe('completed');
      expect(result?.phases[1].status).toBe('active');
      expect(result?.phases[2].status).toBe('upcoming');
      expect(result?.metrics.currentPhaseIndex).toBe(2);
    });
  });

  describe('R2 & BP §43: Future Honesty Verification', () => {
    it('attaches daily tasks ONLY for currentWeek; future weeks have days: [] and hasWrittenTasks: false', () => {
      const goal: Goal = {
        ...baseGoal,
        currentWeek: 2,
        dailyTasks: createMockTasks(2),
        roadmap: {
          finalGoal: 'Goal',
          finalTest: 'Test',
          startingPoint: { value: 0, description: 'Start' },
          method: { name: 'M', creator: 'C', summary: 'S', whyChosen: 'W', runnerUp: null, safety: 5, rules: [] },
          phases: V1_DEFAULT_PHASES,
        },
      };

      const result = toJourneyData(goal);
      expect(result).not.toBeNull();

      const phase1 = result!.phases[0];
      const week1 = phase1.weeks.find((w) => w.weekNumber === 1);
      const week2 = phase1.weeks.find((w) => w.weekNumber === 2);
      const week3 = phase1.weeks.find((w) => w.weekNumber === 3);

      // Week 1 (past): no tasks attached, hasWrittenTasks: false
      expect(week1?.days).toHaveLength(0);
      expect(week1?.hasWrittenTasks).toBe(false);

      // Week 2 (current): tasks attached, hasWrittenTasks: true
      expect(week2?.isCurrentWeek).toBe(true);
      expect(week2?.days).toHaveLength(3);
      expect(week2?.hasWrittenTasks).toBe(true);

      // Week 3 (future): empty days array, hasWrittenTasks: false
      expect(week3?.isCurrentWeek).toBe(false);
      expect(week3?.days).toHaveLength(0);
      expect(week3?.hasWrittenTasks).toBe(false);
    });
  });

  describe('R3: Closing Stretch (OD-2 Option A)', () => {
    it('constructs closing stretch with days 85-90 and proper defaults', () => {
      const result = toJourneyData(baseGoal, '2026-09-01');
      expect(result?.closingStretch).toEqual({
        startDay: 85,
        endDay: 90,
        finalTest: 'Complete your 90-day final evaluation',
        finalGoal: 'Run 10 kilometers in under 50 minutes',
        status: 'upcoming',
        isCurrent: false,
      });
    });

    it('activates closing stretch when currentDay >= 85 and goal is not completed', () => {
      // 5 days before targetDate => calculatedDay = 86
      const nearEndTarget = new Date('2026-11-30T00:00:00.000Z');
      const testNow = new Date(nearEndTarget.getTime() - 5 * 24 * 60 * 60 * 1000);

      const result = toJourneyData(baseGoal, testNow);
      expect(result?.metrics.currentDay).toBe(86);
      expect(result?.closingStretch.status).toBe('active');
      expect(result?.closingStretch.isCurrent).toBe(true);

      // Weeks and phases are completed when in the closing stretch
      expect(result?.phases[0].status).toBe('completed');
      expect(result?.phases[1].status).toBe('completed');
      expect(result?.phases[2].status).toBe('completed');
    });

    it('marks closing stretch as completed when goal.status is completed', () => {
      const completedGoal: Goal = {
        ...baseGoal,
        status: 'completed',
      };

      const result = toJourneyData(completedGoal);
      expect(result?.closingStretch.status).toBe('completed');
      expect(result?.closingStretch.isCurrent).toBe(false);
      expect(result?.metrics.percentComplete).toBe(100);
    });
  });

  describe('R1 & R4: Day Calculation and Clamping', () => {
    it('clamps day to 1 when targetDate is far in the future or start is today', () => {
      const now = new Date('2026-09-01T00:00:00.000Z');
      const day = calculateDayNumber(baseGoal, now);
      expect(day).toBe(1);
    });

    it('clamps day to 90 when targetDate has passed', () => {
      const pastNow = new Date('2026-12-15T00:00:00.000Z');
      const day = calculateDayNumber(baseGoal, pastNow);
      expect(day).toBe(90);
    });

    it('falls back to startDate when targetDate is not available', () => {
      const noTargetGoal = {
        startDate: '2026-09-01T00:00:00.000Z',
        created_at: '2026-09-01T00:00:00.000Z',
      };
      // 10 days elapsed
      const now = new Date('2026-09-11T00:00:00.000Z');
      const day = calculateDayNumber(noTargetGoal, now);
      expect(day).toBe(11);
    });
  });

  describe('R4: Task to Step Mapping', () => {
    const task: DailyTask = {
      id: 't-1',
      goalId: 'g-1',
      weekNumber: 1,
      dayNumber: 5,
      date: '2026-09-05',
      dayOfWeek: 'Friday',
      title: 'Tempo Intervals',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 40,
      isRestDay: false,
      isKeySession: true,
      isTestDay: false,
      whyToday: 'Prime lactate threshold development',
      status: 'pending',
      created_at: '2026-09-01',
    };

    it('marks completed task as completed', () => {
      const step = mapTaskToStep({ ...task, status: 'completed' }, 5, '2026-09-05');
      expect(step.status).toBe('completed');
    });

    it('marks today pending task as active', () => {
      const step = mapTaskToStep(task, 5, '2026-09-05');
      expect(step.status).toBe('active');
      expect(step.isKeySession).toBe(true);
      expect(step.whyToday).toBe('Prime lactate threshold development');
    });

    it('marks past pending task as active to prompt action', () => {
      const step = mapTaskToStep(task, 6, '2026-09-06');
      expect(step.status).toBe('active');
    });

    it('marks future pending task as upcoming', () => {
      const step = mapTaskToStep(task, 3, '2026-09-03');
      expect(step.status).toBe('upcoming');
    });
  });

  describe('R4: Status Progression Across Weeks', () => {
    it('marks previous weeks completed, current week active, future weeks upcoming', () => {
      const goal: Goal = {
        ...baseGoal,
        currentWeek: 5,
        roadmap: {
          finalGoal: 'Goal',
          finalTest: 'Test',
          startingPoint: { value: 0, description: '' },
          method: { name: 'M', creator: 'C', summary: 'S', whyChosen: 'W', runnerUp: null, safety: 5, rules: [] },
          phases: V1_DEFAULT_PHASES,
        },
      };

      const result = toJourneyData(goal, '2026-09-29');
      const allWeeks = result!.phases.flatMap((p) => p.weeks);

      const week4 = allWeeks.find((w) => w.weekNumber === 4);
      const week5 = allWeeks.find((w) => w.weekNumber === 5);
      const week6 = allWeeks.find((w) => w.weekNumber === 6);

      expect(week4?.status).toBe('completed');
      expect(week5?.status).toBe('active');
      expect(week6?.status).toBe('upcoming');
    });
  });

  describe('R5: useJourneyData React Hook', () => {
    const mockGoalContext = (activeGoal: Goal | null) => ({
      activeGoal,
      loadingGoal: false,
      goalLoadFailed: false,
      apiStatus: 'online' as const,
      refreshGoal: vi.fn(),
      setActiveGoal: vi.fn(),
      updateActiveGoal: vi.fn(),
      resetGoal: vi.fn(),
    });

    it('returns null when activeGoal is null', () => {
      vi.mocked(useGoal).mockReturnValue(mockGoalContext(null));
      const { result } = renderHook(() => useJourneyData());
      expect(result.current).toBeNull();
    });

    it('returns memoized JourneyData when activeGoal exists', () => {
      vi.mocked(useGoal).mockReturnValue(mockGoalContext(baseGoal));
      const { result } = renderHook(() => useJourneyData('2026-09-01'));
      expect(result.current).not.toBeNull();
      expect(result.current?.goalId).toBe('goal-test-1');
    });
  });
});
