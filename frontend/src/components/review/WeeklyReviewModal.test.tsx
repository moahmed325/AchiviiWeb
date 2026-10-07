import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../../lib/api';
import type { DailyTask, Goal, RoadmapWeek, WeeklyReviewResponse } from '../../types';
import { WeeklyReviewModal } from './WeeklyReviewModal';
import { loadReviewDraft, loadTestResultDraft } from '../../lib/reviewDraft';

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
    localStorage.clear();
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
    expect(screen.getAllByText('Record 2-minute study')[0]).toBeVisible();
    expect(screen.getByText('Weekly test')).toBeVisible();
    expect(screen.getAllByText('Play Etude without pause at 80 bpm')[0]).toBeVisible();
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

  it('renders closing stretch adaptation when week 12 is completed and displays Enter Closing Stretch CTA (M7.4-R3)', async () => {
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

    // Week 12 CTA must be Enter Closing Stretch, NEVER Start Week 13
    expect(screen.queryByRole('button', { name: 'Start Week 13' })).not.toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: 'Enter Closing Stretch' });
    expect(submitBtn).toBeVisible();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Your closing stretch is ready')).toBeVisible();
      expect(
        screen.getByText('You have completed the 12 planned weeks. Welcome to the Closing Stretch.')
      ).toBeVisible();
      expect(screen.getByRole('heading', { level: 2, name: 'Closing Stretch Ready' })).toBeInTheDocument();
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

  it('persists reflection draft across modal dismissals and restores it on reopen (M7.4-R1)', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(5, 6);
    const goal = createSampleGoal(tasks);
    const onClose = vi.fn();

    const { rerender } = render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={onClose}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Drafting my thoughts on pace and focus.');

    // Stored in localStorage
    expect(loadReviewDraft(goal.id, 1)).toBe('Drafting my thoughts on pace and focus.');

    // User closes modal accidentally
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Modal is reopened
    rerender(
      <WeeklyReviewModal
        isOpen={true}
        onClose={onClose}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    // Reflection is restored
    const reopenedTextarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    expect(reopenedTextarea).toHaveValue('Drafting my thoughts on pace and focus.');
  });

  it('clears stored reflection draft upon successful review submission (M7.4-R1)', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks);

    mockedApi.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'rev-1',
        goalId: goal.id,
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        reflection: 'Completed all sessions.',
        aiAdaptationInsight: 'Good progress.',
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks: [],
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

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Completed all sessions.');
    expect(loadReviewDraft(goal.id, 1)).toBe('Completed all sessions.');

    await user.click(screen.getByRole('button', { name: 'Start Week 2' }));

    await waitFor(() => {
      expect(screen.getByText('Week 2 has been adapted')).toBeVisible();
    });

    // Draft is cleared upon transition to adaptation step
    expect(loadReviewDraft(goal.id, 1)).toBe('');
  });

  it('displays offline network alert and preserves reflection when apiStatus is offline (M7.4-R2)', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(5, 6);
    const goal = createSampleGoal(tasks);

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
        apiStatus="offline"
      />
    );

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Reflecting while offline.');

    const submitBtn = screen.getByRole('button', { name: 'Start Week 2' });
    await user.click(submitBtn);

    // API is not called
    expect(mockedApi.submitWeeklyReview).not.toHaveBeenCalled();

    // Alert rendered with accessible live region
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("You're offline. Reconnect to submit your weekly review.");
    expect(alert).toHaveAttribute('aria-live', 'assertive');

    // Reflection text preserved
    expect(textarea).toHaveValue('Reflecting while offline.');

    // Button allows retry
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('renders non-punitive calm copy and serene styling for empty weeks with 0 completed sessions (M7.4-R4)', () => {
    // 0 completed of 6 active days (0%)
    const tasks = createSampleTasks(0, 6);
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

    expect(screen.getByText('0%')).toBeVisible();
    expect(screen.getByText('0%')).toHaveClass('text-text-secondary');
    expect(screen.getByText('0 of 6 practice sessions completed')).toBeVisible();
    expect(
      screen.getByText('This week had no logged practice. Every week is a chance to reset your pace and adapt.')
    ).toBeVisible();
    expect(
      screen.getByText('This week had no logged practice. Every week is a chance to reset your pace and adapt.')
    ).toHaveClass('text-text-secondary');

    // Guarantees zero shame or failure copy (BP §18)
    expect(screen.queryByText(/fail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/punish/i)).not.toBeInTheDocument();
  });

  it('submits review with benchmark testResult, persists draft, and reveals target comparison in adaptation moment (M7.5)', async () => {
    const user = userEvent.setup();
    const tasks = createSampleTasks(6, 6);
    const goal = createSampleGoal(tasks, {
      target: { kind: 'number', metric: 'Touch Typing Speed', value: 40, unit: 'wpm', direction: 'higher_is_better' },
      test: { type: 'typing_test', instructions: '1-minute test on Aesop', passIf: '40 wpm' },
    });

    const mockResponse: WeeklyReviewResponse = {
      review: {
        id: 'rev-m75',
        goalId: 'g-1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        reflection: 'Pacing was rhythmic and smooth.',
        aiAdaptationInsight: 'Consistency is locked in.',
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks: [],
      testResult: { value: 45, unit: 'wpm', passed: true, note: 'Hit 45 cleanly' },
    };

    mockedApi.submitWeeklyReview.mockResolvedValueOnce(mockResponse);

    render(
      <WeeklyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        goal={goal}
        token="test-token"
        onGoalUpdated={vi.fn()}
      />
    );

    // Benchmark input is visible
    const resultInput = screen.getByLabelText('Your result');
    await user.type(resultInput, '45');

    // Context note
    const noteInput = screen.getByLabelText(/Observation or context/i);
    await user.type(noteInput, 'Hit 45 cleanly');

    // Draft was persisted
    const savedDraft = loadTestResultDraft('g-1', 1);
    expect(savedDraft).toMatchObject({
      value: 45,
      unit: 'wpm',
      passed: true,
      note: 'Hit 45 cleanly',
    });

    // Enter reflection
    const reflectionTextarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(reflectionTextarea, 'Pacing was rhythmic and smooth.');

    // Submit review
    const submitBtn = screen.getByRole('button', { name: 'Start Week 2' });
    await user.click(submitBtn);

    // Verify submitWeeklyReview was called with testResult
    expect(mockedApi.submitWeeklyReview).toHaveBeenCalledWith(
      1,
      'Pacing was rhythmic and smooth.',
      'test-token',
      expect.objectContaining({
        value: 45,
        unit: 'wpm',
        passed: true,
        note: 'Hit 45 cleanly',
      })
    );

    // Target comparison card rendered in Adaptation Moment
    await waitFor(() => {
      expect(screen.getByTestId('adaptation-target-comparison')).toBeVisible();
    });
    expect(screen.getByText('45 wpm')).toBeVisible();
    expect(screen.getByText('Touch Typing Speed: 40 wpm')).toBeVisible();
    expect(screen.getByText('Target Met')).toBeVisible();

    // Drafts cleared after submission
    expect(loadTestResultDraft('g-1', 1)).toBeNull();
    expect(loadReviewDraft('g-1', 1)).toBe('');
  });

  describe('pre-filled from a result logged earlier (missed sessions M4.1 R3)', () => {
    const STORED = { value: 'Completed 4 sets', passed: false, note: 'Fourth set rushed' };
    const response = (testResult: WeeklyReviewResponse['testResult']): WeeklyReviewResponse => ({
      review: { id: 'r', goalId: 'g-1', weekNumber: 1, tasksPlanned: 6, tasksCompleted: 6, scorePercentage: 100, reflection: '', aiAdaptationInsight: '', created_at: '' },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks: [],
      testResult,
    });
    const renderModal = (goal: Goal, isOpen = true) =>
      render(<WeeklyReviewModal isOpen={isOpen} onClose={vi.fn()} goal={goal} token="test-token" onGoalUpdated={vi.fn()} />);

    it('starts the test step from the stored result, before the local draft, and submits it', async () => {
      const user = userEvent.setup();
      localStorage.setItem('achivii_test_result_draft_g-1_w1', JSON.stringify({ value: 'old draft', passed: true }));
      mockedApi.submitWeeklyReview.mockResolvedValueOnce(response(STORED));
      renderModal(createSampleGoal(createSampleTasks(6, 6), { testResult: STORED }));

      expect(screen.getByLabelText('Your result')).toHaveValue('Completed 4 sets');
      expect(screen.getByLabelText(/Observation or context/i)).toHaveValue('Fourth set rushed');
      await user.click(screen.getByRole('button', { name: 'Start Week 2' }));
      expect(mockedApi.submitWeeklyReview).toHaveBeenCalledWith(1, '', 'test-token', STORED);
    });

    it('falls back to the local draft when nothing is stored', () => {
      localStorage.setItem('achivii_test_result_draft_g-1_w1', JSON.stringify({ value: 'my draft', passed: true }));
      renderModal(createSampleGoal(createSampleTasks(6, 6)));
      expect(screen.getByLabelText('Your result')).toHaveValue('my draft');
    });

    it('takes a result stored after it mounted (logged from the late-test card)', () => {
      const tasks = createSampleTasks(6, 6);
      const { rerender } = renderModal(createSampleGoal(tasks), false);
      rerender(
        <WeeklyReviewModal isOpen={true} onClose={vi.fn()} goal={createSampleGoal(tasks, { testResult: STORED })} token="test-token" onGoalUpdated={vi.fn()} />
      );
      expect(screen.getByLabelText('Your result')).toHaveValue('Completed 4 sets');
    });
  });
});
