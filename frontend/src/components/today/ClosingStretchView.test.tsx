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
    dailyTasks: [],
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
      finalTest: 'Run official 10K race under 50 minutes',
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
    expect(screen.getByRole('heading', { level: 2, name: 'The Final Evaluation & Arrival' })).toBeVisible();
    expect(screen.getByText(/The 84 planned deliberate practice days are complete/i)).toBeVisible();
    expect(screen.getByText('Closing Stretch Approach')).toBeVisible();
    expect(screen.getByText('Day 85')).toBeVisible();
    expect(screen.getByText('Day 89')).toBeVisible();
    expect(screen.getAllByText(/Summit/).length).toBeGreaterThan(0);

    const roadmapLink = screen.getByRole('link', { name: 'Review 90-day staircase' });
    expect(roadmapLink).toHaveAttribute('href', '/roadmap');
  });

  it('renders capstone evaluation card with target deliverable and instructions (M9.4-R2)', () => {
    renderComponent();

    expect(screen.getByText('Capstone Benchmark Verification')).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'timer' })).toBeVisible();
    expect(
      screen.getByText('Run 10 kilometers on a measured course at threshold pace.')
    ).toBeVisible();
    expect(screen.getByText(/10K Time: 50 mins/i)).toBeVisible();
    expect(screen.getByText('Time is strictly under 50:00 minutes')).toBeVisible();
    expect(screen.getByText('Run official sub-50 10K race')).toBeVisible();
  });

  it('captures benchmark result toggle, value, notes, and persists reflection draft (M9.4-R2)', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Toggle benchmark achieved / in progress
    const passButton = screen.getByRole('button', { name: 'Benchmark achieved' });
    const inProgressButton = screen.getByRole('button', { name: /In progress.*Reinforcing/ });

    expect(passButton).toBeVisible();
    expect(inProgressButton).toBeVisible();

    await user.click(inProgressButton);
    expect(inProgressButton).toHaveClass('font-semibold');

    // Value input
    const valueInput = screen.getByLabelText('Recorded Score or Deliverable Output');
    await user.clear(valueInput);
    fireEvent.change(valueInput, { target: { value: '49:15 min' } });

    // Notes input
    const notesInput = screen.getByLabelText('Evaluation Notes (optional)');
    fireEvent.change(notesInput, { target: { value: 'Cool morning weather, negative splits.' } });

    // Reflection draft
    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'Ninety days of deliberate practice completely rebuilt my discipline.' } });

    // Verify localStorage draft
    expect(localStorage.getItem('achivii_closing_reflection_goal-90')).toBe(
      'Ninety days of deliberate practice completely rebuilt my discipline.'
    );
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

    const valueInput = screen.getByLabelText('Recorded Score or Deliverable Output');
    fireEvent.change(valueInput, { target: { value: '48:50 min' } });

    const arriveButton = screen.getByRole('button', {
      name: 'Complete Journey & Arrive at the Garden',
    });
    await user.click(arriveButton);

    await waitFor(() => {
      expect(mockCompleteGoal).toHaveBeenCalledWith({
        finalReflection: 'A quiet, earned arrival.',
        finalTestResult: {
          value: '48:50 min',
          unit: undefined,
          passed: true,
          note: undefined,
        },
      });
    });

    expect(localStorage.getItem('achivii_closing_reflection_goal-90')).toBeNull();
  });

  it('allows early / fallback arrival without recorded test score (M9.4-R3)', async () => {
    const user = userEvent.setup();
    mockCompleteGoal.mockResolvedValueOnce({ ...baseGoal, status: 'completed' });

    renderComponent();

    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'Completed early without test.' } });

    const fallbackButton = screen.getByRole('button', { name: 'Arrive without test' });
    await user.click(fallbackButton);

    await waitFor(() => {
      expect(mockCompleteGoal).toHaveBeenCalledWith({
        finalReflection: 'Completed early without test.',
        finalTestResult: null,
      });
    });
  });

  it('handles completion failure with visible alert and allows non-destructive retry (M9.4-R3)', async () => {
    const user = userEvent.setup();
    mockCompleteGoal.mockRejectedValueOnce(new Error("Couldn't write completion right now"));

    renderComponent();

    const reflectionInput = screen.getByLabelText('Final Journey Reflection');
    fireEvent.change(reflectionInput, { target: { value: 'Important draft that must not be lost.' } });

    const arriveButton = screen.getByRole('button', {
      name: 'Complete Journey & Arrive at the Garden',
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
      name: 'Complete Journey & Arrive at the Garden',
    });
    expect(arriveButton).toBeDisabled();

    const fallbackButton = screen.getByRole('button', { name: 'Arrive without test' });
    expect(fallbackButton).toBeDisabled();
  });
});
