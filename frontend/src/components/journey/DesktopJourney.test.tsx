import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoadmapPage } from '../../pages/RoadmapPage';
import { StrategicRoadmap } from './StrategicRoadmap';
import { toJourneyData } from '../../lib/journeyAdapter';
import { useGoal } from '../../context/GoalContext';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../../types';

vi.mock('../../context/GoalContext', () => ({
  useGoal: vi.fn(),
}));

describe('Desktop Journey Composition (M6.3)', () => {
  const baseGoal: Goal = {
    id: 'goal-test-m63',
    userId: 'user-m63',
    rawGoal: 'Run a 10K in 50 Minutes',
    clarifiedOutcome: 'Run 10 kilometers in under 50 minutes',
    methodologyNotes: 'Jack Daniels Running Formula',
    status: 'active',
    startDate: '2026-09-01T00:00:00.000Z',
    targetDate: '2026-11-30T00:00:00.000Z',
    currentWeek: 2,
    answers: '{}',
    routine: '{"dailyMinutes":45,"preferredSlot":"morning","wakeTime":"06:00","sleepTime":"22:00","busyHours":"9-5"}',
    planVersion: 2,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  };

  const createMockTasks = (weekNumber: number): DailyTask[] => [
    {
      id: `task-${weekNumber}-1`,
      goalId: 'goal-test-m63',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 1,
      date: '2026-09-08',
      dayOfWeek: 'Monday',
      title: 'Aerobic Threshold Intervals',
      detailedSteps: '[]',
      implementationIntention: 'Run at community track',
      durationMinutes: 45,
      isRestDay: false,
      isKeySession: true,
      status: 'completed',
      created_at: '2026-09-01',
    },
    {
      id: `task-${weekNumber}-2`,
      goalId: 'goal-test-m63',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 2,
      date: '2026-09-09',
      dayOfWeek: 'Tuesday',
      title: 'Form Drills and Strides',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: false,
      status: 'pending',
      created_at: '2026-09-01',
    },
    {
      id: `task-${weekNumber}-3`,
      goalId: 'goal-test-m63',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 3,
      date: '2026-09-10',
      dayOfWeek: 'Wednesday',
      title: 'Active Recovery Walk',
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 0,
      isRestDay: true,
      status: 'pending',
      created_at: '2026-09-01',
    },
  ];

  const roadmap3Phases: GoalRoadmap = {
    finalGoal: 'Sub-50 10K Finisher',
    startingPoint: { value: 60, description: 'Current 10K: 60 mins' },
    method: {
      name: 'Classic Periodization',
      creator: 'Arthur Lydiard',
      summary: 'Base, Hill training, Sharpening',
      whyChosen: 'Gold standard endurance progression',
      runnerUp: null,
      safety: 5,
      rules: ['Prioritize consistency over excessive speed early on'],
    },
    phases: [
      { name: 'Aerobic Foundation', startWeek: 1, endWeek: 4, purpose: 'Build aerobic engine' },
      { name: 'Anaerobic Development', startWeek: 5, endWeek: 8, purpose: 'Develop lactate threshold' },
      { name: 'Coordination & Taper', startWeek: 9, endWeek: 12, purpose: 'Peak racing readiness' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('R3: Layer 3 — Strategic Roadmap & Future Honesty (BP §43)', () => {
    it('strictly enforces future honesty: future weeks show strategic targets with zero fabricated daily tasks', () => {
      const mockWeeks: RoadmapWeek[] = [
        {
          id: 'rw-1',
          goalId: 'goal-test-m63',
          weekNumber: 1,
          phase: 'Aerobic Foundation',
          theme: 'Initial Adaptation',
          objective: 'Establish running routine',
          keyMilestone: 'Complete 3 runs',
          targetIntensity: 60,
          plannedMinutes: 120,
          status: 'completed',
          created_at: '2026-09-01',
        },
        {
          id: 'rw-2',
          goalId: 'goal-test-m63',
          weekNumber: 2,
          phase: 'Aerobic Foundation',
          theme: 'Building Volume',
          objective: 'Increase distance',
          keyMilestone: 'First 5km continuous run',
          targetIntensity: 65,
          plannedMinutes: 140,
          status: 'active',
          created_at: '2026-09-01',
        },
        {
          id: 'rw-3',
          goalId: 'goal-test-m63',
          weekNumber: 3,
          phase: 'Aerobic Foundation',
          theme: 'Aerobic Threshold',
          objective: 'Pacing test',
          keyMilestone: 'Sustain 5:30/km pace for 20 mins',
          targetIntensity: 70,
          plannedMinutes: 150,
          status: 'pending',
          created_at: '2026-09-01',
        },
      ];

      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        roadmapWeeks: mockWeeks,
        currentWeek: 2,
        dailyTasks: createMockTasks(2),
      };
      const journey = toJourneyData(goal, '2026-09-09');
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <StrategicRoadmap journey={journey!} />
        </MemoryRouter>
      );

      // The roadmap keeps the active week strategic and intentionally hides daily execution detail.
      expect(screen.getByText('Building Volume')).toBeInTheDocument();
      expect(screen.getByText('Your progression')).toBeInTheDocument();
      expect(screen.queryByText(/Run 18km weekly volume/i)).not.toBeInTheDocument();

      // Future weeks must not fabricate daily sessions on the roadmap.
      expect(screen.queryByText('Daily Practice Sessions')).not.toBeInTheDocument();
      expect(screen.queryByText('Aerobic Threshold Intervals')).not.toBeInTheDocument();
      expect(screen.queryByText('Day 15')).not.toBeInTheDocument();
      expect(screen.queryByText('Day 16')).not.toBeInTheDocument();
    });

    it('toggles collapsible phases using buttons with aria-expanded', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        currentWeek: 2, // Phase 1 is active, Phase 2 & 3 are upcoming
      };
      const journey = toJourneyData(goal);
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <StrategicRoadmap journey={journey!} />
        </MemoryRouter>
      );

      // Phase 1 button should be expanded by default
      const phase1Button = screen.getByRole('button', { name: /Aerobic Foundation/i });
      expect(phase1Button).toHaveAttribute('aria-expanded', 'true');

      // Phase 2 button should be collapsed by default
      const phase2Button = screen.getByRole('button', { name: /Anaerobic Development/i });
      expect(phase2Button).toHaveAttribute('aria-expanded', 'false');

      // Click to expand Phase 2
      fireEvent.click(phase2Button);
      expect(phase2Button).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse Phase 1
      fireEvent.click(phase1Button);
      expect(phase1Button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('R4 & Accessibility: Integrated RoadmapPage', () => {
    it('renders main landmark with tabIndex=-1 and full desktop composition', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        dailyTasks: createMockTasks(2),
      };
      vi.mocked(useGoal).mockReturnValue({
        activeGoal: goal,
        loadingGoal: false,
        goalLoadFailed: false,
        goalLoadedFor: null,
        apiStatus: 'online',
        reconciliation: null,
        refreshGoal: vi.fn(),
        applyReconciliation: vi.fn(),
        reloadPlan: vi.fn(),
        closingWeek: false,
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

      render(
        <MemoryRouter>
          <RoadmapPage />
        </MemoryRouter>
      );

      // Check main landmark
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main');
      expect(main).toHaveAttribute('tabIndex', '-1');

      // Check the simplified roadmap hierarchy rendered inside
      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Your roadmap')).toBeInTheDocument();
      expect(screen.getByText('You are here')).toBeInTheDocument();
      expect(screen.getByText('Your progression')).toBeInTheDocument();

      // As on Today (ND-18): the heading is the goal the user chose, the stored outcome beneath it as stored,
      // and the final stretch is named with the same goal, never the model's wording.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Run a 10K in 50 Minutes');
      expect(screen.getByText('Run 10 kilometers in under 50 minutes')).toBeInTheDocument();
      expect(screen.getByText('90-day outcome:')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Run a 10K in 50 Minutes' })).toBeInTheDocument();
      expect(screen.queryByText('Sub-50 10K Finisher')).not.toBeInTheDocument();
    });

    it('does not repeat the goal as its own outcome', () => {
      vi.mocked(useGoal).mockReturnValue({
        activeGoal: { ...baseGoal, clarifiedOutcome: baseGoal.rawGoal, roadmap: roadmap3Phases, dailyTasks: createMockTasks(2) },
        loadingGoal: false,
        goalLoadFailed: false,
        goalLoadedFor: null,
        apiStatus: 'online',
        reconciliation: null,
        refreshGoal: vi.fn(),
        applyReconciliation: vi.fn(),
        reloadPlan: vi.fn(),
        closingWeek: false,
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
      render(
        <MemoryRouter>
          <RoadmapPage />
        </MemoryRouter>
      );
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Run a 10K in 50 Minutes');
      expect(screen.queryByText('90-day outcome:')).not.toBeInTheDocument();
    });

    it('renders accessible fallback when no active goal exists', () => {
      vi.mocked(useGoal).mockReturnValue({
        activeGoal: null,
        loadingGoal: false,
        goalLoadFailed: false,
        goalLoadedFor: null,
        apiStatus: 'online',
        reconciliation: null,
        refreshGoal: vi.fn(),
        applyReconciliation: vi.fn(),
        reloadPlan: vi.fn(),
        closingWeek: false,
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

      render(
        <MemoryRouter>
          <RoadmapPage />
        </MemoryRouter>
      );

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(screen.getByText('No Active Journey')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Create Your Journey/i })).toBeInTheDocument();
    });
  });
});
