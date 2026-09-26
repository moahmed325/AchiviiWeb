import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../../lib/api';
import type { DailyTask, Goal, RoadmapWeek, WeeklyReviewResponse } from '../../types';
import { WeeklyReviewModal } from './WeeklyReviewModal';

vi.mock('../../lib/api', () => ({
  submitWeeklyReview: vi.fn(),
}));

const mockedApi = vi.mocked(api);

const createSampleTasks = (completedCount: number, restDayIndex = 6): DailyTask[] => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days.map((dayOfWeek, idx) => ({
    id: `task-${idx + 1}`,
    goalId: 'g-1',
    weekNumber: 1,
    dayNumber: idx + 1,
    date: '2026-09-26',
    dayOfWeek,
    title: `Practice Day ${idx + 1}`,
    isRestDay: idx === restDayIndex,
    status: idx < completedCount ? 'completed' : 'pending',
    durationMinutes: 45,
    slotTime: '08:00',
    created_at: '',
  })) as DailyTask[];
};

const createSampleWeek = (overrides?: Partial<RoadmapWeek>): RoadmapWeek => ({
  id: 'rw-1',
  goalId: 'g-1',
  weekNumber: 1,
  phase: 'Foundation',
  theme: 'Form & Mechanics',
  objective: 'Build muscle memory and steady pacing',
  keyMilestone: 'Consistent posture across 5 sessions',
  targetIntensity: 3,
  plannedMinutes: 240,
  status: 'active',
  created_at: '',
  target: { kind: 'deliverable', description: 'Clean practice log' },
  test: {
    type: 'count',
    instructions: 'Complete 5 unbroken sequences with precision',
    passIf: '5 sets unbroken',
  },
  ...overrides,
});

const createSampleGoal = (tasks: DailyTask[], weekOverrides?: Partial<RoadmapWeek>): Goal =>
  ({
    id: 'g-1',
    userId: 'u-1',
    rawGoal: 'Master Classical Guitar Technique',
    clarifiedOutcome: 'Play Villa-Lobos Etude 1 cleanly at 100 bpm',
    methodologyNotes: 'Deliberate practice with metronome',
    status: 'active',
    startDate: '2026-09-01',
    targetDate: '2026-11-30',
    currentWeek: 1,
    answers: '{}',
    routine: '{}',
    created_at: '',
    updated_at: '',
    roadmapWeeks: [
      createSampleWeek(weekOverrides),
      {
        id: 'rw-2',
        goalId: 'g-1',
        weekNumber: 2,
        phase: 'Foundation',
        theme: 'Arpeggios & Fluidity',
        objective: 'Develop finger independence',
        keyMilestone: 'Play etude at 60 bpm',
        targetIntensity: 3,
        plannedMinutes: 240,
        status: 'pending',
        created_at: '',
        target: { kind: 'deliverable', description: 'Recording at 60 bpm' },
      },
    ],
    dailyTasks: tasks,
  }) as Goal;

describe('WeeklyReviewModal Component (M7.2 & M7.3 Review Flow UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders week title, score percentage, and session count excluding rest days', () => {
    // 6 active days, 5 completed (83%), 1 rest day
    const tasks = createSampleTasks(5, 6);
    const goal = createSampleGoal(tasks);
    const onGoalUpdated = vi.fn();
    const onClose = vi.fn();

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={onClose}
        goal={goal}
        token="test-token"
        onGoalUpdated={onGoalUpdated}
      />
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Week 1 Review' })).toBeVisible();
    expect(screen.getByText('83%')).toBeVisible();
    expect(screen.getByText('5 of 6 practice sessions completed')).toBeVisible();
  });

  it('renders encouraging momentum copy and accent styling for high completion (>= 80%)', () => {
    const tasks = createSampleTasks(5, 6); // 5/6 = 83%
    const goal = createSampleGoal(tasks);

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    expect(
      screen.getByText('Great week! Next week will build on this momentum.')
    ).toBeVisible();
    expect(screen.getByText('83%')).toHaveClass('text-accent');
  });

  it('renders calm non-punitive copy and warm styling for lower completion (< 80%)', () => {
    // 2 completed of 6 active days (33%)
    const tasks = createSampleTasks(2, 6);
    const goal = createSampleGoal(tasks);

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('33%')).toBeVisible();
    expect(
      screen.getByText('Next week will adapt to help you find your rhythm.')
    ).toBeVisible();
    expect(screen.getByText('33%')).toHaveClass('text-caution');
    // Guarantees BP §18 "Adapt the journey, don't punish the person": no failure or danger copy
    expect(screen.queryByText(/fail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/punish/i)).not.toBeInTheDocument();
  });

  it('renders weekly target deliverable, test instructions, and focus theme when present', () => {
    const tasks = createSampleTasks(4, 6);
    const goal = createSampleGoal(tasks, {
      theme: 'Hand Independence & Fingering',
      target: { kind: 'deliverable', description: 'Record 2-minute study' },
      test: {
        type: 'count',
        instructions: 'Play Etude without pause at 80 bpm',
        passIf: '0 stops or memory slips',
      },
    });

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    expect(screen.getByText('Focus')).toBeVisible();
    expect(screen.getByText('Hand Independence & Fingering')).toBeVisible();
    expect(screen.getByText('Target')).toBeVisible();
    expect(screen.getByText('Record 2-minute study')).toBeVisible();
    expect(screen.getByText('Weekly test')).toBeVisible();
    expect(screen.getByText('Play Etude without pause at 80 bpm')).toBeVisible();
  });

  it('captures reflection, transitions to Adaptation Moment step, and finishes review on continue', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);
    const onGoalUpdated = vi.fn();
    const onClose = vi.fn();

    const nextWeekTasks: DailyTask[] = [
      {
        id: 'task-w2-1',
        goalId: 'g-1',
        weekNumber: 2,
        dayNumber: 8,
        date: '2026-10-03',
        dayOfWeek: 'Monday',
        title: 'Arpeggio drills',
        durationMinutes: 45,
        slotTime: '08:00',
        status: 'pending',
        isRestDay: false,
        created_at: '',
      } as DailyTask,
    ];

    mockedApi.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'rev-1',
        goalId: 'g-1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        reflection: 'Sessions felt natural in the mornings.',
        aiAdaptationInsight: 'Great rhythm. Increasing tempo slightly.',
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks,
    });

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={onClose}
        goal={goal}
        token="test-token-xyz"
        onGoalUpdated={onGoalUpdated}
      />
    );

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Sessions felt natural in the mornings.');

    const submitBtn = screen.getByRole('button', { name: 'Start Week 2' });
    await user.click(submitBtn);

    expect(mockedApi.submitWeeklyReview).toHaveBeenCalledTimes(1);
    expect(mockedApi.submitWeeklyReview).toHaveBeenCalledWith(
      1,
      'Sessions felt natural in the mornings.',
      'test-token-xyz'
    );

    // M7.3 Adaptation Step is displayed
    await waitFor(() => {
      expect(screen.getByText('Week 2 has been adapted')).toBeVisible();
    });
    expect(screen.getByText('Great rhythm. Increasing tempo slightly.')).toBeVisible();
    expect(screen.getByText('Arpeggios & Fluidity')).toBeVisible();

    // Not closed yet until user confirms adaptation
    expect(onClose).not.toHaveBeenCalled();

    // User clicks "Continue to Today"
    const continueBtn = screen.getByRole('button', { name: 'Continue to Today' });
    await user.click(continueBtn);

    await waitFor(() => {
      expect(onGoalUpdated).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    const updatedGoal = onGoalUpdated.mock.calls[0][0] as Goal;
    expect(updatedGoal.currentWeek).toBe(2);
    expect(updatedGoal.roadmapWeeks?.[0].status).toBe('completed');
    expect(updatedGoal.roadmapWeeks?.[0].executionScore).toBe(100);
  });

  it('prevents double submission while request is in-flight', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);

    let resolvePromise: (val: WeeklyReviewResponse) => void;
    mockedApi.submitWeeklyReview.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    const submitBtn = screen.getByRole('button', { name: 'Start Week 2' });
    await user.click(submitBtn);

    // Loading and blocked immediately to prevent double click
    expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    expect(submitBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    // Secondary clicks do not trigger another API call
    await user.click(submitBtn);
    expect(mockedApi.submitWeeklyReview).toHaveBeenCalledTimes(1);

    // Resolve
    resolvePromise!({
      review: {
        id: 'r1',
        goalId: 'g-1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks: [],
    });
  });

  it('handles 503 error gracefully: preserves reflection, shows alert, and allows retry', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(5, 6);
    const goal = createSampleGoal(tasks);
    const onGoalUpdated = vi.fn();

    mockedApi.submitWeeklyReview.mockRejectedValueOnce(
      new Error("Couldn't write next week right now. This week is unchanged; please try again.")
    );

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={onGoalUpdated}
      />
    );

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Challenging week due to work travel');

    await user.click(screen.getByRole('button', { name: 'Start Week 2' }));

    // Alert rendered
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't write next week right now. This week is unchanged; please try again."
    );
    // Reflection is kept intact
    expect(textarea).toHaveValue('Challenging week due to work travel');

    // Button offers retry
    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    expect(retryBtn).toBeVisible();

    // Now resolve successfully on retry
    mockedApi.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'r2',
        goalId: 'g-1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 5,
        scorePercentage: 83,
        created_at: '',
      },
      scorePercentage: 83,
      nextWeekNumber: 2,
      nextWeekTasks: [],
    });

    await user.click(retryBtn);

    await waitFor(() => {
      expect(mockedApi.submitWeeklyReview).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Week 2 has been adapted')).toBeVisible();
    });

    // Continue to finish
    await user.click(screen.getByRole('button', { name: 'Continue to Today' }));
    expect(onGoalUpdated).toHaveBeenCalledTimes(1);
  });

  it('renders PhaseGateOutcomeCard and triggers onMilestoneGate when milestone checkpoint is returned', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);
    const onMilestoneGate = vi.fn();

    mockedApi.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'r1',
        goalId: 'g-1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 5,
      nextWeekTasks: [],
      isMilestoneCheckpoint: true,
      milestoneGateTransition: {
        title: 'Phase 1 Complete',
        completedPhase: 'Foundation',
        nextPhase: 'Acceleration',
        benchmarkMet: true,
      },
    });

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
        onMilestoneGate={onMilestoneGate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Start Week 2' }));

    await waitFor(() => {
      expect(onMilestoneGate).toHaveBeenCalledTimes(1);
      expect(onMilestoneGate).toHaveBeenCalledWith({
        title: 'Phase 1 Complete',
        completedPhase: 'Foundation',
        nextPhase: 'Acceleration',
        benchmarkMet: true,
      });
      // Visual phase gate card in adaptation step
      expect(screen.getByText('Foundation Complete')).toBeVisible();
      expect(screen.getByText('Milestone Achieved')).toBeVisible();
    });
  });

  it('renders closing stretch adaptation when week 12 is completed', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);
    const onGoalUpdated = vi.fn();

    mockedApi.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'r12',
        goalId: 'g-1',
        weekNumber: 12,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        aiAdaptationInsight: 'Completed final planned week.',
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: null, // Final week completed
      nextWeekTasks: [],
    });

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={{ ...goal, currentWeek: 12 }}
        token="test-token"
        onGoalUpdated={onGoalUpdated}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Start Week 13' }));

    await waitFor(() => {
      expect(screen.getByText('Your closing stretch is ready')).toBeVisible();
      expect(
        screen.getByText('You have completed the 12 planned weeks. Welcome to the Closing Stretch.')
      ).toBeVisible();
    });
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);
    const onClose = vi.fn();

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={onClose}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
