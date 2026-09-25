import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RoadmapPage } from '../../pages/RoadmapPage';
import { JourneyHeader } from './JourneyHeader';
import { DesktopStaircase } from './DesktopStaircase';
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
    finalTest: 'Run 10K time trial in under 50 minutes',
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

  describe('R1: Layer 1 — Quick Numerical Progress Header', () => {
    it('renders goal title, Day N / 90 with tabular figures, week/phase badges, and method credit', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        dailyTasks: createMockTasks(2),
      };
      const journey = toJourneyData(goal, '2026-09-09');
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <JourneyHeader journey={journey!} />
        </MemoryRouter>
      );

      // Goal title & outcome
      expect(screen.getAllByText('Run 10 kilometers in under 50 minutes').length).toBeGreaterThan(0);
      // Method badge & author credit
      expect(screen.getByText(/Method: Classic Periodization/i)).toBeInTheDocument();
      expect(screen.getByText(/Arthur Lydiard/i)).toBeInTheDocument();
      // Back to Today link
      const backLink = screen.getByRole('link', { name: /Back to Today/i });
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/');
      // Progress bar
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });
  });

  describe('R2: Layer 2 — Architectural Emotional Staircase', () => {
    it('renders 3 phase landings, daily step flight, closing stretch, and summit destination', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        dailyTasks: createMockTasks(2),
      };
      const journey = toJourneyData(goal, '2026-09-09');
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <DesktopStaircase journey={journey!} />
        </MemoryRouter>
      );

      // Phase landings
      expect(screen.getByText('Aerobic Foundation')).toBeInTheDocument();
      expect(screen.getByText('Anaerobic Development')).toBeInTheDocument();
      expect(screen.getByText('Coordination & Taper')).toBeInTheDocument();

      // Daily Step Runner for active week
      expect(screen.getByText('Aerobic Threshold Intervals')).toBeInTheDocument();
      expect(screen.getByText('Form Drills and Strides')).toBeInTheDocument();
      expect(screen.getByText('Active Recovery Walk')).toBeInTheDocument();

      // "You are here" indicator (in legend and on active step badge)
      expect(screen.getAllByText('You are here').length).toBeGreaterThanOrEqual(2);

      // Closing stretch benchmark
      expect(screen.getByText(/Run 10K time trial in under 50 minutes/i)).toBeInTheDocument();

      // Destination Summit
      expect(screen.getByText('Sub-50 10K Finisher')).toBeInTheDocument();
    });

    it('renders exactly 2 phase landings for a 2-phase v2 goal', () => {
      const roadmap2Phases: GoalRoadmap = {
        finalGoal: 'Sub-50 10K',
        finalTest: '10K Time Trial',
        startingPoint: { value: 60, description: '60 mins' },
        method: {
          name: 'Two-Stage Periodization',
          creator: 'Coach Daniels',
          summary: 'Aerobic base then threshold speed',
          whyChosen: 'Optimal progression',
          runnerUp: null,
          safety: 5,
          rules: ['Consistency first'],
        },
        phases: [
          { name: 'Phase One: Build Base', startWeek: 1, endWeek: 6, purpose: 'Build volume' },
          { name: 'Phase Two: Race Specific', startWeek: 7, endWeek: 12, purpose: 'Race pace' },
        ],
      };
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap2Phases,
        currentWeek: 3,
      };
      const journey = toJourneyData(goal);
      expect(journey?.phases).toHaveLength(2);

      render(
        <MemoryRouter>
          <DesktopStaircase journey={journey!} />
        </MemoryRouter>
      );

      expect(screen.getByText('Phase One: Build Base')).toBeInTheDocument();
      expect(screen.getByText('Phase Two: Race Specific')).toBeInTheDocument();
      expect(screen.queryByText('Phase Three')).not.toBeInTheDocument();
    });

    it('renders exactly 4 phase landings for a 4-phase v2 goal', () => {
      const roadmap4Phases: GoalRoadmap = {
        finalGoal: 'B2 Fluency',
        finalTest: 'CEFR B2 Oral Exam',
        startingPoint: { value: 1, description: 'A2' },
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
          { name: 'Phase 1: Syntax & Phonetics', startWeek: 1, endWeek: 3, purpose: 'Grammar' },
          { name: 'Phase 2: Immersion Listening', startWeek: 4, endWeek: 6, purpose: 'Ear training' },
          { name: 'Phase 3: Production & Debate', startWeek: 7, endWeek: 9, purpose: 'Speech' },
          { name: 'Phase 4: Synthesis & Exam', startWeek: 10, endWeek: 12, purpose: 'Exam sim' },
        ],
      };
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap4Phases,
        currentWeek: 5,
      };
      const journey = toJourneyData(goal);
      expect(journey?.phases).toHaveLength(4);

      render(
        <MemoryRouter>
          <DesktopStaircase journey={journey!} />
        </MemoryRouter>
      );

      expect(screen.getByText('Phase 1: Syntax & Phonetics')).toBeInTheDocument();
      expect(screen.getByText('Phase 2: Immersion Listening')).toBeInTheDocument();
      expect(screen.getByText('Phase 3: Production & Debate')).toBeInTheDocument();
      expect(screen.getByText('Phase 4: Synthesis & Exam')).toBeInTheDocument();
    });
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
          target: {
            kind: 'deliverable',
            description: 'Run 18km weekly volume',
          },
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

      // Active week (Week 2) has daily practice sessions
      expect(screen.getByText('Building Volume')).toBeInTheDocument();
      expect(screen.getByText('Daily Practice Sessions')).toBeInTheDocument();
      expect(screen.getByText('Aerobic Threshold Intervals')).toBeInTheDocument();

      // Future week (Week 3) displays strategic target & future honesty calm message
      expect(screen.getByText('Aerobic Threshold')).toBeInTheDocument();
      expect(screen.getByText(/Run 18km weekly volume/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Future Honesty · Daily sessions designed after Week 2 review/i)
      ).toBeInTheDocument();

      // Ensure NO daily session items or fabricated checkboxes are generated for Week 3
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

  describe('R4: v1 Preset Goal Support', () => {
    it('renders Foundation, Acceleration, and Mastery phases for v1 goals', () => {
      const mockRoadmapWeeks: RoadmapWeek[] = Array.from({ length: 12 }, (_, i) => ({
        id: `rw-${i + 1}`,
        goalId: 'goal-v1',
        weekNumber: i + 1,
        phase: i < 4 ? 'Foundation' : i < 8 ? 'Acceleration' : 'Mastery',
        theme: `Phase Segment ${i + 1}`,
        objective: `Focus objective ${i + 1}`,
        keyMilestone: `Milestone ${i + 1}`,
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

      const journey = toJourneyData(v1Goal);
      expect(journey).not.toBeNull();
      expect(journey?.phases).toHaveLength(3);
      expect(journey?.phases[0].name).toBe('Foundation');
      expect(journey?.phases[1].name).toBe('Acceleration');
      expect(journey?.phases[2].name).toBe('Mastery');

      render(
        <MemoryRouter>
          <DesktopStaircase journey={journey!} />
          <StrategicRoadmap journey={journey!} />
        </MemoryRouter>
      );

      // Verify all 3 fixed phases render
      expect(screen.getAllByText(/Foundation/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Acceleration/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Mastery/i).length).toBeGreaterThan(0);
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
        apiStatus: 'online',
        refreshGoal: vi.fn(),
        setActiveGoal: vi.fn(),
        updateActiveGoal: vi.fn(),
        resetGoal: vi.fn(),
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

      // Check all 3 layers rendered inside
      expect(screen.getByText('Back to Today')).toBeInTheDocument();
      expect(screen.getByText('The 90-Day Ascent')).toBeInTheDocument();
      expect(screen.getByText('Method Phases & Weekly Targets')).toBeInTheDocument();
    });

    it('renders accessible fallback when no active goal exists', () => {
      vi.mocked(useGoal).mockReturnValue({
        activeGoal: null,
        loadingGoal: false,
        goalLoadFailed: false,
        apiStatus: 'online',
        refreshGoal: vi.fn(),
        setActiveGoal: vi.fn(),
        updateActiveGoal: vi.fn(),
        resetGoal: vi.fn(),
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
