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

// Missed sessions M4.1 (RULE-7, UX-3, AC-8): the late-test card, rendered on Today.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn(),
    logWeeklyTestResult: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The week runs from two days ago; `testOffset` is the test day relative to today. */
const tasks = (testOffset: number, extra: (t: DailyTask, offset: number) => Partial<DailyTask> = () => ({})): DailyTask[] =>
  DAYS.map((dayOfWeek, index) => {
    const offset = index - 2;
    const t = {
      id: `t${index + 1}`,
      goalId: 'g1',
      weekNumber: 1,
      dayNumber: index + 1,
      date: isoDay(offset),
      dayOfWeek,
      title: `Session ${index + 1}`,
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: index === 6,
      isTestDay: offset === testOffset,
      status: 'pending',
      created_at: '',
    } as DailyTask;
    return { ...t, ...extra(t, offset) };
  });

const WEEK = {
  id: 'w1',
  goalId: 'g1',
  weekNumber: 1,
  phase: 'Base',
  theme: 'Easy miles',
  status: 'active',
  target: { kind: 'number', metric: '5 km time', value: 27, unit: 'min', direction: 'lower_is_better' },
  test: { type: 'time_trial', instructions: 'Run 5 km at an even, hard effort.', passIf: 'under 27 minutes' },
  testResult: null,
} as unknown as RoadmapWeek;

const goal = (week: Partial<RoadmapWeek> = {}, extra: Partial<Goal> = {}): Goal =>
  ({
    id: 'g1',
    planVersion: 2,
    rawGoal: 'Run a 10K',
    clarifiedOutcome: 'Sub-50 10K',
    status: 'active',
    currentWeek: 1,
    targetDate: `${isoDay(80)}T00:00:00.000Z`,
    roadmapWeeks: [{ ...WEEK, ...week }],
    dailyTasks: tasks(-1),
    ...extra,
  }) as unknown as Goal;

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

const card = () => screen.queryByRole('region', { name: "This week's test is still open" });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(goal());
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
});

describe('Late-test card on Today (missed sessions M4.1)', () => {
  it('after test day, shows one calm card with the test as the test-day card shows it', async () => {
    await renderToday();
    const region = card()!;
    expect(region).toBeVisible();
    expect(within(region).getByRole('heading', { level: 2, name: "This week's test is still open" })).toBeVisible();
    expect(within(region).getByText("Take it when you can. Your result goes into this week's review.")).toBeVisible();
    expect(within(region).getByText('Run 5 km at an even, hard effort.')).toBeVisible();
    expect(within(region).getByText('Pass mark:')).toBeVisible();
    expect(within(region).getByText('Pass if under 27 minutes.')).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Log my result' })).toBeVisible();
    expect(screen.getAllByRole('region', { name: "This week's test is still open" })).toHaveLength(1);
    for (const word of [/\blate\b/i, /missed/i, /behind/i, /failed/i]) expect(region.textContent).not.toMatch(word);
  });

  it('is not shown before the test day closes: the test day is today, or reconcile still has it open', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({}, { dailyTasks: tasks(0) }));
    await renderToday();
    expect(card()).toBeNull();
  });

  describe('follows reconcile over the date', () => {
    const body = (taskId: string, offset: number, kind: 'planned' | 'missed' | 'done') => ({
      applies: true as const, goalId: 'g1', asOf: '', timezone: 'UTC',
      days: [{ taskId, date: isoDay(offset), weekNumber: 1, dayNumber: 1, isKeySession: false, isTestDay: true, kind }],
      gap: null,
      carry: { enabled: false, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
      signals: { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null },
    });

    it("yesterday's test day that reconcile still has open (before its close) shows nothing", async () => {
      mocked.reconcileGoal.mockResolvedValue(body('t2', -1, 'planned'));
      await renderToday();
      expect(card()).toBeNull();
    });

    it('a test day reconcile classifies missed shows the card', async () => {
      mocked.reconcileGoal.mockResolvedValue(body('t2', -1, 'missed'));
      await renderToday();
      expect(card()).toBeVisible();
    });

    it("today's test day, done without a result, shows the card (reconcile classifies it done)", async () => {
      mocked.fetchActiveGoal.mockResolvedValue(goal({}, { dailyTasks: tasks(0, (_, offset) => (offset === 0 ? { status: 'completed' } : {})) }));
      mocked.reconcileGoal.mockResolvedValue(body('t3', 0, 'done'));
      await renderToday();
      expect(card()).toBeVisible();
    });
  });

  it.each([
    ['a result is logged', goal({ testResult: { value: 26, unit: 'min', passed: true } })],
    ['the week is completed', goal({ status: 'completed' })],
    ['the goal is plan v1', goal({}, { planVersion: 1 })],
    ['the week has no test (old goal)', goal({ test: null })],
  ])('is not shown when %s', async (_, g) => {
    mocked.fetchActiveGoal.mockResolvedValue(g);
    await renderToday();
    expect(card()).toBeNull();
  });

  it('still shows on a rest day today', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({}, { dailyTasks: tasks(-1, (_, offset) => (offset === 0 ? { isRestDay: true } : {})) }));
    await renderToday();
    expect(screen.getByText("Today's rest")).toBeInTheDocument();
    expect(card()).toBeVisible();
  });

  it('logs a result without the review, refreshes the goal, and the card goes', async () => {
    const user = userEvent.setup();
    mocked.logWeeklyTestResult.mockResolvedValue({ testResult: { value: 26, unit: 'min', passed: true } });
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal({ testResult: { value: 26, unit: 'min', passed: true } }));

    await user.click(screen.getByRole('button', { name: 'Log my result' }));
    const dialog = await screen.findByRole('dialog', { name: 'Log my result' });
    expect(within(dialog).getByRole('button', { name: 'Save result' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Your result'), '26');
    await user.click(within(dialog).getByRole('button', { name: 'Save result' }));

    expect(mocked.logWeeklyTestResult).toHaveBeenCalledWith(1, { value: 26, unit: 'min', passed: true, note: undefined }, 't');
    await waitFor(() => expect(screen.queryByText("This week's test is still open")).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
  });

  it('a failed save keeps the form and its value, and says so', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.logWeeklyTestResult.mockRejectedValue(new api.ApiError('This week has already been reviewed.', 409, 'week_closed'));
    await renderToday();

    await user.click(screen.getByRole('button', { name: 'Log my result' }));
    const dialog = await screen.findByRole('dialog', { name: 'Log my result' });
    await user.type(within(dialog).getByLabelText('Your result'), '28');
    await user.click(within(dialog).getByRole('button', { name: 'Save result' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
    expect(within(dialog).getByLabelText('Your result')).toHaveValue('28');
    // The page behind the open dialog is aria-hidden, so look for the card's heading text.
    expect(screen.getByText("This week's test is still open")).toBeInTheDocument();
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('Escape closes the dialog and returns focus to "Log my result"', async () => {
    const user = userEvent.setup();
    await renderToday();
    const trigger = screen.getByRole('button', { name: 'Log my result' });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Log my result' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveFocus();
  });
});
