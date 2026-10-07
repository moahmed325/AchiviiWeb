import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../types';
import { AchievementPage } from './AchievementPage';
import { useGoal } from '../context/GoalContext';

vi.mock('../context/GoalContext', () => ({
  useGoal: vi.fn(),
}));

const mockCompletedGoal: Goal = {
  id: 'goal-page-test-1',
  userId: 'usr-1',
  rawGoal: 'Write a non-fiction book draft',
  clarifiedOutcome: 'Write 50,000-word manuscript draft',
  methodologyNotes: 'Systematic daily word-count pacing',
  canonicalMethodName: 'Daily Output Architecture',
  status: 'completed',
  startDate: '2026-06-01',
  targetDate: '2026-08-30',
  currentWeek: 12,
  answers: '{}',
  routine: '{}',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-08-30T10:00:00Z',
  completedAt: '2026-08-30T10:00:00Z',
  roadmapWeeks: [],
  dailyTasks: [],
  weeklyReviews: [],
};

const baseGoalContext = {
  activeGoal: mockCompletedGoal,
  loadingGoal: false,
  goalLoadFailed: false,
  goalLoadedFor: null,
  apiStatus: 'online' as const,
  reconciliation: null,
  refreshGoal: vi.fn(),
  setActiveGoal: vi.fn(),
  updateActiveGoal: vi.fn(),
  resetGoal: vi.fn(),
  completeGoal: vi.fn(),
  completeActiveGoal: vi.fn(),
};

describe('AchievementPage Route Destination (M9.3-R1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders achievement screen when goal is provided via GoalContext', () => {
    vi.mocked(useGoal).mockReturnValue(baseGoalContext);

    render(
      <MemoryRouter>
        <AchievementPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'COMPLETE' })).toBeInTheDocument();
    expect(screen.getByText('Write a non-fiction book draft')).toBeInTheDocument();
    expect(screen.getByText(/50,000-word manuscript draft/)).toBeInTheDocument();
  });

  it('2. Prioritizes explicitly passed goal prop over GoalContext', () => {
    const propGoal: Goal = {
      ...mockCompletedGoal,
      id: 'prop-goal-id',
      rawGoal: 'Learn intermediate conversational Japanese',
    };
    vi.mocked(useGoal).mockReturnValue(baseGoalContext);

    render(
      <MemoryRouter>
        <AchievementPage goal={propGoal} />
      </MemoryRouter>
    );

    expect(screen.getByText('Learn intermediate conversational Japanese')).toBeInTheDocument();
  });

  it('3. Renders loading indicator while goal is loading', () => {
    vi.mocked(useGoal).mockReturnValue({
      ...baseGoalContext,
      activeGoal: null,
      loadingGoal: true,
    });

    render(
      <MemoryRouter>
        <AchievementPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading achievement destination...')).toBeInTheDocument();
  });

  it('4. Redirects to root when no goal is present and loading settles', () => {
    vi.mocked(useGoal).mockReturnValue({
      ...baseGoalContext,
      activeGoal: null,
      loadingGoal: false,
    });

    render(
      <MemoryRouter initialEntries={['/achievement']}>
        <AchievementPage />
      </MemoryRouter>
    );

    // Achievement heading should not be rendered
    expect(screen.queryByRole('heading', { level: 1, name: 'COMPLETE' })).not.toBeInTheDocument();
  });
});
