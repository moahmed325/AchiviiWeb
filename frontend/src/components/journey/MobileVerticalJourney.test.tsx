import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileVerticalJourney } from './MobileVerticalJourney';
import { toJourneyData } from '../../lib/journeyAdapter';
import type { DailyTask, Goal, GoalRoadmap, RoadmapWeek } from '../../types';

describe('MobileVerticalJourney (M6.4)', () => {
  const baseGoal: Goal = {
    id: 'goal-mobile-test',
    userId: 'user-mobile',
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
      goalId: 'goal-mobile-test',
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + 1,
      date: '2026-09-08',
      dayOfWeek: 'Monday',
      title: 'Aerobic Threshold Intervals',
      detailedSteps: '[]',
      implementationIntention: 'Community track',
      durationMinutes: 45,
      isRestDay: false,
      isKeySession: true,
      status: 'completed',
      created_at: '2026-09-01',
    },
    {
      id: `task-${weekNumber}-2`,
      goalId: 'goal-mobile-test',
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
      goalId: 'goal-mobile-test',
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
      whyChosen: 'Gold standard progression',
      runnerUp: null,
      safety: 5,
      rules: ['Consistency first'],
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

  describe('R1: Vertical Spine & Stepper Progression', () => {
    it('renders a vertical timeline spine with phase landings, daily steps, and summit destination', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        dailyTasks: createMockTasks(2),
      };
      const journey = toJourneyData(goal, '2026-09-09');
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      // Verify vertical journey landmark
      expect(screen.getByTestId('mobile-vertical-journey')).toBeInTheDocument();
      expect(screen.getByText('Vertical Progression')).toBeInTheDocument();

      // Phase landings exist
      expect(screen.getByText('Aerobic Foundation')).toBeInTheDocument();
      expect(screen.getByText('Anaerobic Development')).toBeInTheDocument();
      expect(screen.getByText('Coordination & Taper')).toBeInTheDocument();

      // Active week daily steps render along the spine
      expect(screen.getByText('Aerobic Threshold Intervals')).toBeInTheDocument();
      expect(screen.getByText('Form Drills and Strides')).toBeInTheDocument();
      expect(screen.getByText('Active Recovery Walk')).toBeInTheDocument();

      // Closing stretch and summit destination
      expect(screen.getByText(/Days 85–90 · The Closing Stretch/i)).toBeInTheDocument();
      expect(screen.getByText(/Run 10K time trial in under 50 minutes/i)).toBeInTheDocument();
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
          <MobileVerticalJourney journey={journey!} />
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
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      expect(screen.getByText('Phase 1: Syntax & Phonetics')).toBeInTheDocument();
      expect(screen.getByText('Phase 2: Immersion Listening')).toBeInTheDocument();
      expect(screen.getByText('Phase 3: Production & Debate')).toBeInTheDocument();
      expect(screen.getByText('Phase 4: Synthesis & Exam')).toBeInTheDocument();
    });

    it('renders v1 preset goal with 3 fixed phases (Foundation, Acceleration, Mastery)', () => {
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

      render(
        <MemoryRouter>
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      expect(screen.getByText('Foundation')).toBeInTheDocument();
      expect(screen.getByText('Acceleration')).toBeInTheDocument();
      expect(screen.getByText('Mastery')).toBeInTheDocument();
    });
  });

  describe('R2: "You Are Here" Auto-Positioning & Active Step Indication', () => {
    it('prominently displays the You Are Here badge and marks the active step node', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        dailyTasks: createMockTasks(2),
      };
      const journey = toJourneyData(goal, '2026-09-09');
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      // Verify top pill badge
      const headerPill = screen.getByTestId('you-are-here-badge');
      expect(headerPill).toBeInTheDocument();
      expect(headerPill).toHaveTextContent(/You are here · Day 9/i);

      // Verify active step card has data-testid and badge
      const activeStep = screen.getByTestId('active-step-node');
      expect(activeStep).toBeInTheDocument();
      expect(activeStep).toHaveTextContent('Day 9');
      expect(activeStep).toHaveTextContent('Form Drills and Strides');
      expect(activeStep).toHaveTextContent('You are here');
    });
  });

  describe('R3: Tap Targets & Accordion Affordances', () => {
    it('provides >= 44px tap targets on all phase accordion toggles', () => {
      const goal: Goal = {
        ...baseGoal,
        roadmap: roadmap3Phases,
        currentWeek: 2,
      };
      const journey = toJourneyData(goal);
      expect(journey).not.toBeNull();

      render(
        <MemoryRouter>
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        // Assert min-h-[44px] styling class is present on all interactive touch targets
        expect(btn.className).toContain('min-h-[44px]');
      }

      // Check aria-expanded behavior
      const phase1Btn = screen.getByRole('button', { name: /Aerobic Foundation/i });
      expect(phase1Btn).toHaveAttribute('aria-expanded', 'true');

      const phase2Btn = screen.getByRole('button', { name: /Anaerobic Development/i });
      expect(phase2Btn).toHaveAttribute('aria-expanded', 'false');

      // Tap phase 2 to expand
      fireEvent.click(phase2Btn);
      expect(phase2Btn).toHaveAttribute('aria-expanded', 'true');

      // Tap phase 1 to collapse
      fireEvent.click(phase1Btn);
      expect(phase1Btn).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('R1 & BP §43: Future Honesty on Mobile', () => {
    it('displays strategic targets for future weeks with zero fabricated tasks', () => {
      const mockWeeks: RoadmapWeek[] = [
        {
          id: 'rw-1',
          goalId: 'goal-mobile-test',
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
          goalId: 'goal-mobile-test',
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
          goalId: 'goal-mobile-test',
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
          <MobileVerticalJourney journey={journey!} />
        </MemoryRouter>
      );

      // Active week 2 shows daily flight
      expect(screen.getByText('Daily Practice Flight')).toBeInTheDocument();
      expect(screen.getByText('Aerobic Threshold Intervals')).toBeInTheDocument();

      // Future week 3 displays strategic targets and honest message
      expect(screen.getByText('Aerobic Threshold')).toBeInTheDocument();
      expect(screen.getByText(/Run 18km weekly volume/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Future Honesty · Daily sessions designed after Week 2 review/i)
      ).toBeInTheDocument();

      // Ensure NO daily tasks or checkboxes for future week 3
      expect(screen.queryByText('Day 15')).not.toBeInTheDocument();
      expect(screen.queryByText('Day 16')).not.toBeInTheDocument();
    });
  });
});
