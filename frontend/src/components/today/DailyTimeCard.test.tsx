import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal, RoadmapWeek } from '../../types';
import { Today } from './Today';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';

// Weekly update M3.3b (RULE-6, AC-5): the daily-time card on Today.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    closeWeek: vi.fn(async () => ({ due: false as const })),
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn(),
    answerDailyTime: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEAD = { title: 'Easy run', instructions: 'Run easy.', durationMinutes: 15, priority: 1 };

/** Week 4 runs from two days ago. */
const tasks = (): DailyTask[] =>
  DAYS.map((dayOfWeek, index) => {
    const offset = index - 2;
    return {
      id: `t${index + 1}`,
      goalId: 'g1',
      weekNumber: 4,
      dayNumber: 21 + index + 1,
      date: isoDay(offset),
      dayOfWeek,
      title: `Session ${index + 1}`,
      detailedSteps: JSON.stringify([LEAD]),
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: index === 6,
      isTestDay: false,
      status: 'pending',
      created_at: '',
    } as DailyTask;
  });

const week = (weekNumber: number, status: string, extra: Partial<RoadmapWeek> = {}) =>
  ({
    id: `w${weekNumber}`,
    goalId: 'g1',
    weekNumber,
    phase: 'Base',
    theme: 'Easy miles',
    status,
    ...extra,
  }) as unknown as RoadmapWeek;

const goal = (extra: Partial<Goal> = {}): Goal => {
  return {
    id: 'g1',
    planVersion: 2,
    rawGoal: 'Run a 10K',
    clarifiedOutcome: 'Sub-50 10K',
    status: 'active',
    currentWeek: 4,
    targetDate: `${isoDay(60)}T00:00:00.000Z`,
    roadmapWeeks: [week(3, 'completed'), week(4, 'active')],
    dailyTasks: tasks(),
    dailyTimeCheck: null,
    ...extra,
  } as unknown as Goal;
};

const Harness = () => {
  const { activeGoal } = useGoal();
  return activeGoal ? <Today goal={activeGoal} /> : null;
};

const renderToday = async () => {
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter>
          <Harness />
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(goal());
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
});

describe('The daily-time card (AC-5)', () => {
  const card = () => screen.queryByRole('region', { name: 'Does 60 minutes a day still work?' });

  beforeEach(() => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({ dailyTimeCheck: { minutes: 60, shorter: [30, 45] } }));
  });

  it('asks with the exact words and buttons', async () => {
    await renderToday();
    expect(card()).toBeVisible();
    expect(screen.getByRole('button', { name: 'Keep 60 minutes' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Make it shorter' })).toBeVisible();
  });

  it('is not shown when dailyTimeCheck is null', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal());
    await renderToday();
    expect(card()).toBeNull();
  });

  it('Keep posts the current minutes, refreshes the goal and closes the card', async () => {
    const user = userEvent.setup();
    mocked.answerDailyTime.mockResolvedValue({ dailyMinutes: 60, dailyTimeAskedAt: '' });
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal());
    await user.click(screen.getByRole('button', { name: 'Keep 60 minutes' }));
    expect(mocked.answerDailyTime).toHaveBeenCalledWith(60, 't');
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByText(/From next week/)).toBeNull();
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
  });

  it('Make it shorter offers the shorter options; choosing one posts it and says when it applies', async () => {
    const user = userEvent.setup();
    mocked.answerDailyTime.mockResolvedValue({ dailyMinutes: 45, dailyTimeAskedAt: '' });
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal());
    await user.click(screen.getByRole('button', { name: 'Make it shorter' }));
    expect(screen.getByRole('button', { name: '30 min' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '45 min' }));
    expect(mocked.answerDailyTime).toHaveBeenCalledWith(45, 't');
    expect(await screen.findByText('From next week, your sessions are 45 minutes.')).toHaveAttribute('role', 'status');
    expect(card()).toBeNull();
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
  });

  it('while choosing a shorter time, Keep is still offered', async () => {
    const user = userEvent.setup();
    mocked.answerDailyTime.mockResolvedValue({ dailyMinutes: 60, dailyTimeAskedAt: '' });
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal());
    await user.click(screen.getByRole('button', { name: 'Make it shorter' }));
    expect(screen.getByRole('button', { name: '45 min' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep 60 minutes' }));
    expect(mocked.answerDailyTime).toHaveBeenCalledWith(60, 't');
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByText(/From next week/)).toBeNull();
  });

  it.each(['no_daily_time_check', 'week_close_disabled'])('a 409 %s refreshes the goal so the card goes, with no error', async (code) => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.answerDailyTime.mockRejectedValue(new api.ApiError('This action is not available yet.', 409, code));
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal());
    await user.click(screen.getByRole('button', { name: 'Keep 60 minutes' }));
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByText("That didn't save. Please try again.")).toBeNull();
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a failed answer says so and keeps the card', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.answerDailyTime.mockRejectedValue(new Error('offline'));
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Keep 60 minutes' }));
    expect(await within(card()!).findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
    expect(card()).toBeVisible();
    warn.mockRestore();
  });
});
