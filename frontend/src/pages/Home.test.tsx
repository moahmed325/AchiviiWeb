import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { GoalProvider } from '../context/GoalContext';
import * as api from '../lib/api';
import type { Goal } from '../types';
import { Home } from './Home';

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
  clarifiedOutcome: '49.98',
  currentWeek: 1,
  targetDate: new Date(Date.now() + 88 * 86_400_000).toISOString(),
  roadmapWeeks: [{ weekNumber: 1, phase: 'Aerobic base', theme: 'Easy miles' }],
  dailyTasks: [],
} as unknown as Goal;

describe('Home Page (R1 — Goal-load error & pathway guarding)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('achivii_auth_token', 'test-token');
    mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString(), service: 'achivii-api' });
    mocked.fetchCurrentUser.mockResolvedValue(MOCK_USER);
  });

  it('renders dedicated error state when goal loading fails, with working retry', async () => {
    const user = userEvent.setup();
    mocked.fetchActiveGoal.mockRejectedValueOnce(new Error('Failed to fetch'));

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    // Reassuring error state with role="alert"
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: "We couldn't load your goal" })).toBeVisible();
    expect(
      screen.getByText('Your plan is safe, but we had trouble reaching Achivii. Check your connection or try again.')
    ).toBeVisible();

    // Must NOT show the pathway library or prompt starting a new goal
    expect(screen.queryByText('Choose a pathway')).not.toBeInTheDocument();
    expect(screen.queryByText('Start your journey')).not.toBeInTheDocument();

    // Click "Try again" button
    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    expect(retryBtn).toBeVisible();

    // Next fetch succeeds with active goal
    mocked.fetchActiveGoal.mockResolvedValueOnce(MOCK_GOAL);
    await user.click(retryBtn);

    // Upon retry success, renders Today
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: "We couldn't load your goal" })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K Under 50 Minutes' })).toBeVisible();
  });

  it('renders pathway library when active goal is genuinely null without error', async () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce(null as unknown as Goal);

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a pathway' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: "We couldn't load your goal" })).not.toBeInTheDocument();
  });
});
