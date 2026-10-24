import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  toJourneyData,
  calculateDayNumber,
  mapTaskToStep,
  useJourneyData,
} from './journeyAdapter';
import type { DailyTask, Goal, GoalRoadmap, RoadmapPhase } from '../types';
import { doneDaysOf } from './stepLines';
import { useGoal } from '../context/GoalContext';

vi.mock('../context/GoalContext', () => ({
  useGoal: vi.fn(),
}));

const THREE_PHASES: RoadmapPhase[] = [
  { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Base' },
  { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Build' },
  { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak' },
];

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
    roadmap: {
      finalGoal: 'Run 10 kilometers in under 50 minutes',
      finalTest: '10K time trial',
      startingPoint: { value: 0, description: 'Start' },
      method: { name: 'M', creator: 'C', summary: 'S', whyChosen: 'W', runnerUp: null, safety: 5, rules: [] },
      phases: THREE_PHASES,
    },
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

    it('derives correct top-level identity fields', () => {
      const result = toJourneyData(baseGoal);
      expect(result).not.toBeNull();
      expect(result?.goalId).toBe('goal-test-1');
      expect(result?.rawGoal).toBe('Run a 10K in 50 Minutes');
      expect(result?.clarifiedOutcome).toBe('Run 10 kilometers in under 50 minutes');
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

    it('gives a goal without a roadmap no phases instead of invented ones (ND-21)', () => {
      const result = toJourneyData({ ...baseGoal, planVersion: 1, roadmap: null, currentWeek: 5 });
      expect(result).not.toBeNull();
      expect(result?.phases).toEqual([]);
      expect(result?.metrics.totalPhases).toBe(0);
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
          phases: THREE_PHASES,
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
      const result = toJourneyData({ ...baseGoal, roadmap: { ...baseGoal.roadmap!, finalTest: '' } }, '2026-09-01');
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

      const result = toJourneyData(baseGoal, testNow, 'UTC');
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

    it('counts only completed as done; an unknown stored status is not done (B-11)', () => {
      const legacy = { ...task, status: 'skipped' } as unknown as DailyTask;
      expect(mapTaskToStep(legacy, 5, '2026-09-05').status).toBe('active');
      expect(mapTaskToStep(legacy, 3, '2026-09-03').status).toBe('upcoming');
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
          phases: THREE_PHASES,
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
      goalLoadedFor: null,
      apiStatus: 'online' as const,
      reconciliation: null,
      refreshGoal: vi.fn(),
      applyReconciliation: vi.fn(),
      reloadPlan: vi.fn(),
      closingWeek: false,
      heldClose: null,
      answerHeldClose: vi.fn(),
      pendingChoice: null,
      answerChoice: vi.fn(),
      closeFailed: false,
      retryClose: vi.fn(),
      setActiveGoal: vi.fn(),
      updateActiveGoal: vi.fn(),
      resetGoal: vi.fn(),
      completeGoal: vi.fn(),
      completeActiveGoal: vi.fn(),
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

// Weekly update M1.4 (RULE-14, AC-11, WU-26): a move shifts startDate and targetDate, so "Day N" skips the moved days
// and lines up with the plan index the journey compares it with; a day not offered is shown like a rest day.
describe('journeyAdapter after a move (weekly update M1.4)', () => {
  // Moved 4 days: week 3 (plan days 15 to 21) starts on Friday 2026-10-09 instead of Monday 2026-10-05.
  const MOVED = 4;
  const day = (n: number, over: Partial<DailyTask> = {}): DailyTask => ({
    id: `d${n}`,
    goalId: 'g',
    weekNumber: Math.ceil(n / 7),
    dayNumber: n,
    date: new Date(Date.UTC(2026, 8, 21 + MOVED * (n > 14 ? 1 : 0) + n - 1)).toISOString().slice(0, 10),
    dayOfWeek: 'Day',
    title: `Session ${n}`,
    detailedSteps: '[]',
    implementationIntention: '',
    durationMinutes: 30,
    isRestDay: false,
    status: n <= 14 ? 'completed' : 'pending',
    created_at: '',
    ...over,
  });
  const goal = {
    id: 'g',
    status: 'active',
    currentWeek: 3,
    planVersion: 2,
    startDate: '2026-09-25T00:00:00.000Z', // 2026-09-21 + 4
    targetDate: '2026-12-24T00:00:00.000Z', // 2026-12-20 + 4
    roadmap: { phases: [{ name: 'Base', startWeek: 1, endWeek: 12, purpose: '' }] },
    roadmapWeeks: [],
    dailyTasks: [...Array.from({ length: 21 }, (_, i) => day(i + 1))],
  } as unknown as Goal;

  it('"Day N" leaves the moved days out: the first day back is plan day 15', () => {
    expect(calculateDayNumber(goal, new Date('2026-10-09T12:00:00Z'), 'UTC')).toBe(15);
    // The startDate fallback (no targetDate) follows the move the same way.
    expect(calculateDayNumber({ startDate: goal.startDate }, new Date('2026-10-09T12:00:00Z'))).toBe(15);
  });

  it("the journey marks today's step active and the steps after it upcoming", () => {
    const data = toJourneyData(goal, '2026-10-09', 'UTC')!;
    const steps = data.phases[0].weeks[2].days;
    expect(steps.find((s) => s.dayNumber === 15)!.status).toBe('active');
    expect(steps.find((s) => s.dayNumber === 16)!.status).toBe('upcoming');
  });

  it('a day not offered is shown as a rest day, never as a step to do', () => {
    const step = mapTaskToStep(day(15, { notOffered: true }), 17, '2026-10-11');
    expect(step.isRestDay).toBe(true);
    expect(mapTaskToStep(day(16), 17, '2026-10-11').isRestDay).toBe(false);
    // One holding the in-order queue's toNextWeek records reads the same (review change 1).
    const records = JSON.stringify([{ stepNumber: 1, title: 'Lesson 100', kind: 'lesson', toNextWeek: [{ taskId: 'd15', date: '2026-10-09', step: { title: 'Lesson 104' } }] }]);
    expect(mapTaskToStep(day(15, { notOffered: true, detailedSteps: records }), 17, '2026-10-11')).toMatchObject({ isRestDay: true, status: 'active' });
  });

  it('reads a day through visibleDay: a moved step done on its source day is hidden (B-54)', () => {
    const tempo = { stepNumber: 1, title: 'Tempo run', durationMinutes: 20, instructions: '', priority: 1 };
    const notes = { stepNumber: 2, title: 'Fri notes', durationMinutes: 15, instructions: '', priority: 2 };
    const done = doneDaysOf([{ id: 'd15', status: 'completed', detailedSteps: JSON.stringify([tempo]) }]);
    const moved = { ...tempo, carriedFrom: { taskId: 'd15', date: '2026-10-09', replaced: [] } };
    const friday = day(16, { title: 'Tempo run', durationMinutes: 35, detailedSteps: JSON.stringify([moved, notes]) });
    expect(mapTaskToStep(friday, 17, '2026-10-11', done)).toMatchObject({ title: 'Fri notes', durationMinutes: 15 });
    // Without the done day, the stored day is shown.
    expect(mapTaskToStep(friday, 17, '2026-10-11')).toMatchObject({ title: 'Tempo run', durationMinutes: 35 });
  });
});
