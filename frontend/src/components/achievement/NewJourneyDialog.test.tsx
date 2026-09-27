import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Goal } from '../../types';
import { NewJourneyDialog } from './NewJourneyDialog';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('NewJourneyDialog Component (M9.4-R4 & R-15)', () => {
  const completedGoal = {
    id: 'goal-completed-1',
    userId: 'u1',
    rawGoal: 'Master Classical Piano Technique',
    clarifiedOutcome: 'Perform Chopin Nocturne Op. 9 No. 2 from memory',
    status: 'completed',
    completedAt: '2026-09-27T16:00:00.000Z',
    targetDate: '2026-09-27T16:00:00.000Z',
    currentWeek: 12,
    methodologyNotes: 'Daily deliberate scales and repertoire',
    dailyTasks: [],
    roadmapWeeks: [],
    created_at: '2026-06-29T16:00:00.000Z',
    updated_at: '2026-09-27T16:00:00.000Z',
  } as unknown as Goal;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with completed goal details and succession safety reassurance (R-15)', () => {
    render(
      <NewJourneyDialog
        open={true}
        onOpenChange={vi.fn()}
        goal={completedGoal}
      />
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Begin Your Next Journey' })).toBeVisible();
    expect(
      screen.getByText(/Your completed 90-day journey is permanently preserved in your archives/i)
    ).toBeVisible();

    expect(screen.getByText('Completed 90-Day Journey')).toBeVisible();
    expect(screen.getByText('Master Classical Piano Technique')).toBeVisible();
    expect(screen.getByText('Perform Chopin Nocturne Op. 9 No. 2 from memory')).toBeVisible();
    expect(screen.getByText('Path: 90 Days')).toBeVisible();

    // Succession reassurance
    expect(screen.getByText(/Permanently Preserved:/i)).toBeVisible();
    expect(
      screen.getByText(
        /Your practice history, reflections, and benchmark test results remain intact in your personal archive/i
      )
    ).toBeVisible();
  });

  it('calls onOpenChange(false) when clicking Stay in the Garden', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <NewJourneyDialog
        open={true}
        onOpenChange={handleOpenChange}
        goal={completedGoal}
      />
    );

    const stayButton = screen.getByRole('button', { name: 'Stay in the Garden' });
    await user.click(stayButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('navigates to /onboarding with switchGoal and fromCompletedGoal state on Choose Next Pathway', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <NewJourneyDialog
        open={true}
        onOpenChange={handleOpenChange}
        goal={completedGoal}
      />
    );

    const chooseButton = screen.getByRole('button', { name: 'Choose Next Pathway' });
    await user.click(chooseButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(mockNavigate).toHaveBeenCalledWith('/onboarding', {
      state: {
        switchGoal: true,
        fromCompletedGoal: true,
      },
    });
  });

  it('invokes custom onConfirm callback when provided', async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <NewJourneyDialog
        open={true}
        onOpenChange={handleOpenChange}
        goal={completedGoal}
        onConfirm={handleConfirm}
      />
    );

    const chooseButton = screen.getByRole('button', { name: 'Choose Next Pathway' });
    await user.click(chooseButton);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(handleConfirm).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
