import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { GoalProvider } from '../context/GoalContext';
import * as api from '../lib/api';
import type { Goal } from '../types';
import { ProgressPage } from './ProgressPage';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
  };
});

const mocked = vi.mocked(api);

const MOCK_USER = {
  id: 'u1',
  email: 'runner@example.com',
  name: 'Runner',
  created_at: '2026-09-21',
};

const MOCK_GOAL = {
  id: 'g1',
  rawGoal: 'Run a 10K Under 50 Minutes',
  clarifiedOutcome: 'Achieve sub-50 minute 10K pace',
  currentWeek: 1,
  targetDate: new Date(Date.now() + 88 * 86_400_000).toISOString(),
  roadmapWeeks: [{ weekNumber: 1, phase: 'Foundation', theme: 'Easy miles' }],
  dailyTasks: [],
} as unknown as Goal;

describe('ProgressPage (M8.4 — Early and Empty States, Error Resilience)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('achivii_auth_token', 'test-token');
    mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString(), service: 'achivii-api' });
    mocked.fetchCurrentUser.mockResolvedValue(MOCK_USER);
  });

  it('renders loading skeleton while loadingGoal is true', () => {
    // Return pending promise so it stays in loading state
    mocked.fetchActiveGoal.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <ProgressPage />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Loading your progress/i)).toBeInTheDocument();
  });

  it('renders dedicated error state when goal loading fails, with working retry', async () => {
    const user = userEvent.setup();
    mocked.fetchActiveGoal.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <ProgressPage />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>,
    );

    // Visible error alert with role="alert"
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't load your progress" })).toBeVisible();
    expect(
      screen.getByText('Your plan is safe, but we had trouble reaching Achivii. Check your connection or try again.'),
    ).toBeVisible();

    // Click "Try again" button
    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    expect(retryBtn).toBeVisible();

    // Next fetch succeeds with active goal
    mocked.fetchActiveGoal.mockResolvedValueOnce(MOCK_GOAL);
    await user.click(retryBtn);

    // Upon retry success, renders ProgressPage with goal title
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: "We couldn't load your progress" })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K Under 50 Minutes' })).toBeVisible();
  });

  it('renders empty state when activeGoal is genuinely null without error', async () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce(null as unknown as Goal);

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <ProgressPage />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'No Active Journey' })).toBeVisible();
    expect(screen.getByText('Start your 90-day journey to see your progress here.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create Your Journey' })).toHaveAttribute('href', '/onboarding');
  });

  it('renders progress dashboard when activeGoal is present', async () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce(MOCK_GOAL);

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <ProgressPage />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K Under 50 Minutes' })).toBeVisible();
    expect(screen.getByText('Achieve sub-50 minute 10K pace')).toBeVisible();
  });
});
