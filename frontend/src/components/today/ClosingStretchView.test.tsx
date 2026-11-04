import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../../types';
import { ClosingStretchView } from './ClosingStretchView';

const mockCompleteGoal = vi.fn();

vi.mock('../../context/GoalContext', () => ({
  useGoal: () => ({
    completeGoal: mockCompleteGoal,
    activeGoal: null,
    apiStatus: 'online',
  }),
}));

describe('ClosingStretchView Component (M9.4)', () => {
  const baseGoal = {
    id: 'goal-90',
    userId: 'u1',
    rawGoal: 'Run 10K in under 50 minutes',
    clarifiedOutcome: 'Official chip-timed 10K under 49:59',
    status: 'active',
    currentWeek: 12,
    targetDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // Day 89
    methodologyNotes: 'Structured aerobic conditioning',
    dailyTasks: [
      { id: 'd1', weekNumber: 12, dayNumber: 78, status: 'completed', isRestDay: false },
      { id: 'd2', weekNumber: 12, dayNumber: 79, status: 'completed', isRestDay: false },
      { id: 'd3', weekNumber: 12, dayNumber: 80, status: 'pending', isRestDay: false },
      { id: 'd4', weekNumber: 12, dayNumber: 81, status: 'pending', isRestDay: true },
    ],
    // An older goal's stored week 12 target and test: never shown (no weekly tests, 2026-10-30).
    roadmapWeeks: [
      {
        id: 'rw12',
        goalId: 'goal-90',
        weekNumber: 12,
        phase: 'Capstone',
        theme: 'Taper & Final Verification',
        focus: 'Peak performance execution',
        target: {
          kind: 'number',
          metric: '10K Time',
          value: 50,
          unit: 'mins',
          direction: 'lower_is_better',
        },
        test: {
          type: 'timer',
          instructions: 'Run 10 kilometers on a measured course at threshold pace.',
          passIf: 'Time is strictly under 50:00 minutes',
        },
      },
    ],
    roadmap: {
      finalGoal: 'Run official sub-50 10K race',
      phases: [],
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Goal;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderComponent = (overrides?: Partial<Goal>, apiStatus?: 'online' | 'offline' | 'checking') => {
    const goal = { ...baseGoal, ...overrides } as Goal;
    return render(
      <MemoryRouter>
        <ClosingStretchView goal={goal} apiStatus={apiStatus} />
      </MemoryRouter>
    );
  };

  it('renders closing stretch header, 6-day approach indicator, and roadmap link (M9.4-R1)', () => {
    renderComponent();

    expect(screen.getByText(/DAYS 85.*90.*THE CLOSING STRETCH/)).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Look back and arrive' })).toBeVisible();
    expect(screen.getByText(/The 84 planned practice days are complete/i)).toBeVisible();
    expect(screen.getByText('Closing Stretch Approach')).toBeVisible();
    expect(screen.getByText('Day 85')).toBeVisible();
    expect(screen.getByText('Day 89')).toBeVisible();
    expect(screen.getAllByText(/Summit/).length).toBeGreaterThan(0);

    const roadmapLink = screen.getByRole('link', { name: 'Review 90-day staircase' });
    expect(roadmapLink).toHaveAttribute('href', '/roadmap');
  });

  it('B-109: a 6-week plan ending 3 days before an exam shows its own days and the days to the date', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // 6 weeks (42 days) ended yesterday; the exam is in 3 days, so the plan has 44 days (days 43 and 44 closing).
    const startDate = new Date(today.getTime() - 42 * DAY).toISOString();
    const fixedDate = new Date(today.getTime() + 3 * DAY).toISOString();
    const targetDate = new Date(today.getTime() + 2 * DAY).toISOString();
    renderComponent({ totalWeeks: 6, startDate, targetDate, fixedDate, currentWeek: 6 });

    expect(screen.getByText(/DAYS 43.*44.*THE CLOSING STRETCH/)).toBeVisible();
    expect(screen.getByText(/The 42 planned practice days are complete/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review 6-week staircase' })).toBeVisible();
    expect(screen.getByText('Day 43 of 44')).toBeVisible();
    expect(screen.queryByText(/84 planned/)).toBeNull();
  });

  it('shows what they did and their goal, with no final test (no weekly tests)', () => {
    renderComponent();
    expect(screen.getByText('What you did')).toBeVisible();
    expect(screen.getByText('2 of 3 sessions')).toBeVisible();
    expect(screen.getByText('Run official sub-50 10K race')).toBeVisible();
    expect(screen.queryByText(/Capstone|Benchmark|Run 10 kilometers|50 mins/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Arrive without test' })).toBeNull();
  });

  it('keeps the reflection draft as it is typed (M9.4-R2)', () => {
    renderComponent();
    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'Ninety days of deliberate practice completely rebuilt my discipline.' } });
    expect(localStorage.getItem('achivii_closing_reflection_goal-90')).toBe('Ninety days of deliberate practice completely rebuilt my discipline.');
  });

  it('restores existing reflection draft from localStorage on mount (M9.4-R2)', () => {
    localStorage.setItem(
      'achivii_closing_reflection_goal-90',
      'Saved previous draft reflection across page refresh.'
    );
    renderComponent();

    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    expect(reflectionInput).toHaveValue('Saved previous draft reflection across page refresh.');
  });

  it('invokes completeGoal with payload and clears draft on primary arrival CTA (M9.4-R3)', async () => {
    const user = userEvent.setup();
    mockCompleteGoal.mockResolvedValueOnce({ ...baseGoal, status: 'completed' });

    renderComponent();

    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'A quiet, earned arrival.' } });

    const arriveButton = screen.getByRole('button', {
      name: 'Complete my journey',
    });
    await user.click(arriveButton);

    await waitFor(() => {
      expect(mockCompleteGoal).toHaveBeenCalledWith({ finalReflection: 'A quiet, earned arrival.' });
    });

    expect(localStorage.getItem('achivii_closing_reflection_goal-90')).toBeNull();
  });

  it('handles completion failure with visible alert and allows non-destructive retry (M9.4-R3)', async () => {
    const user = userEvent.setup();
    mockCompleteGoal.mockRejectedValueOnce(new Error("Couldn't write completion right now"));

    renderComponent();

    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'Important draft that must not be lost.' } });

    const arriveButton = screen.getByRole('button', {
      name: 'Complete my journey',
    });
    await user.click(arriveButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeVisible();
      expect(screen.getByText("Couldn't record completion")).toBeVisible();
    });

    // Reflection draft is still preserved
    expect(reflectionInput).toHaveValue('Important draft that must not be lost.');

    // Retry with success
    mockCompleteGoal.mockResolvedValueOnce({ ...baseGoal, status: 'completed' });
    const retryButton = screen.getByRole('button', { name: 'Try again' });
    await user.click(retryButton);

    await waitFor(() => {
      expect(mockCompleteGoal).toHaveBeenCalledTimes(2);
    });
  });

  it('displays offline notice and disables completion actions when offline (M9.4-R3)', () => {
    renderComponent(undefined, 'offline');

    expect(
      screen.getByText(/Achivii is offline. Reconnect to complete your journey/i)
    ).toBeVisible();

    const arriveButton = screen.getByRole('button', {
      name: 'Complete my journey',
    });
    expect(arriveButton).toBeDisabled();
  });
});

// Plan safety limits M1.3 (PSL-9, PSL-12): the honest line under the Summit Target when week 12 was lowered.
