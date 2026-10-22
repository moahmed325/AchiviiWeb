import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal, Retest, RoadmapWeek } from '../../types';
import { Today } from './Today';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { RETEST_LINES } from '../../lib/retest';

// Weekly update M3.3b (RULE-5, RULE-6, AC-4, AC-5): the re-test line, the re-test result entry and the daily-time card.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    closeWeek: vi.fn(async () => ({ due: false as const })),
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn(),
    logWeeklyTestResult: vi.fn(),
    answerDailyTime: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const RETEST_STEP = { title: 'Re-test: Run 5 km at an even, hard effort', instructions: 'Run 5 km.', durationMinutes: 15, priority: 2 };
const EASY_STEP = { title: 'Re-test: an easy version', instructions: 'Easy.', durationMinutes: 15, priority: 2 };
const LEAD = { title: 'Easy run', instructions: 'Run easy.', durationMinutes: 15, priority: 1 };

/** Week 4 runs from two days ago; the re-test step sits on the day `retestOffset` from today. */
const tasks = (retestOffset: number | null, step = RETEST_STEP): DailyTask[] =>
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
      detailedSteps: JSON.stringify(offset === retestOffset ? [step, LEAD] : [LEAD]),
      implementationIntention: '',
      durationMinutes: 30,
      isRestDay: index === 6,
      isTestDay: index === 5,
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
    target: { kind: 'number', metric: '5 km time', value: 27, unit: 'min', direction: 'lower_is_better' },
    test: { type: 'time_trial', instructions: 'Run 5 km at an even, hard effort.', passIf: 'under 27 minutes' },
    testResult: null,
    ...extra,
  }) as unknown as RoadmapWeek;

const goal = (extra: Partial<Goal> = {}, retestOffset: number | null = 0, step = RETEST_STEP): Goal =>
  ({
    id: 'g1',
    planVersion: 2,
    rawGoal: 'Run a 10K',
    clarifiedOutcome: 'Sub-50 10K',
    status: 'active',
    currentWeek: 4,
    targetDate: `${isoDay(60)}T00:00:00.000Z`,
    roadmapWeeks: [week(3, 'completed'), week(4, 'active')],
    dailyTasks: tasks(retestOffset, step),
    retest: { ofWeek: 3, reason: 'not_logged', logged: false } as Retest,
    dailyTimeCheck: null,
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

const logButton = () => screen.queryByRole('button', { name: 'Log re-test result' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(goal());
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
});

describe('The re-test line (AC-4)', () => {
  it.each([
    ['not_logged', RETEST_LINES.not_logged],
    ['two_hard_weeks', RETEST_LINES.two_hard_weeks],
  ] as const)('on the re-test day, %s shows its exact line as a status, with no dismiss', async (reason, line) => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({ retest: { ofWeek: 3, reason, logged: false } }));
    await renderToday();
    expect(screen.getByText(line)).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    for (const word of [/missed/i, /behind/i, /failed/i, /\bfail\b/i]) expect(line).not.toMatch(word);
  });

  it('the exact words of the copy table', () => {
    expect(RETEST_LINES.not_logged).toBe(
      "Last week's test wasn't logged, so we're holding your target. This week starts with a quick re-test so we can adjust."
    );
    expect(RETEST_LINES.two_hard_weeks).toBe('The last two weeks were hard to fit in. This week starts with a re-test to find your real level.');
  });

  it.each([
    ['on another day (the re-test was yesterday)', goal({}, -1)],
    ['before the re-test day', goal({}, 1)],
    ['once it is logged', goal({ retest: { ofWeek: 3, reason: 'not_logged', logged: true } })],
    ['when retest is null', goal({ retest: null })],
    ['for the easy re-test (it never sets retest; a stray one is ignored)', goal({}, 0, EASY_STEP)],
  ])('is not shown %s', async (_, g) => {
    mocked.fetchActiveGoal.mockResolvedValue(g);
    await renderToday();
    expect(screen.queryByText(RETEST_LINES.not_logged)).toBeNull();
  });
});

describe('The re-test result entry (AC-4, WU-17)', () => {
  it('offered from the re-test day to the end of the week, not before it', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({}, -1));
    await renderToday();
    expect(logButton()).toBeVisible();
  });

  it.each([
    ['before the re-test day', goal({}, 1)],
    ['once logged', goal({ retest: { ofWeek: 3, reason: 'not_logged', logged: true } })],
    ['for a light week (cannot happen)', goal({ roadmapWeeks: [week(3, 'completed', { test: { type: 'light', instructions: 'Log the long run.', passIf: 'Done as written', light: true } as never }), week(4, 'active')] })],
    ['with no re-test', goal({ retest: null })],
  ])('not offered %s', async (_, g) => {
    mocked.fetchActiveGoal.mockResolvedValue(g);
    await renderToday();
    expect(logButton()).toBeNull();
  });

  it('logs the result as the re-tested week\'s result, refreshes the goal, and the line and entry go', async () => {
    const user = userEvent.setup();
    mocked.logWeeklyTestResult.mockResolvedValue({ testResult: { value: 26, unit: 'min', passed: true } });
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal({ retest: { ofWeek: 3, reason: 'not_logged', logged: true } }));

    await user.click(logButton()!);
    const dialog = await screen.findByRole('dialog', { name: 'Log re-test result' });
    expect(within(dialog).getByText('Run 5 km at an even, hard effort.')).toBeVisible();
    expect(within(dialog).getByText('Pass if under 27 minutes.')).toBeVisible();
    await user.type(within(dialog).getByLabelText('Your result'), '26');
    await user.click(within(dialog).getByRole('button', { name: 'Save result' }));

    expect(mocked.logWeeklyTestResult).toHaveBeenCalledWith(3, { value: 26, unit: 'min', passed: true, note: undefined }, 't');
    await waitFor(() => expect(logButton()).toBeNull());
    expect(screen.queryByText(RETEST_LINES.not_logged)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a failed save says so and saves nothing later', async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.logWeeklyTestResult.mockRejectedValue(new Error('offline'));
    await renderToday();
    await user.click(logButton()!);
    const dialog = await screen.findByRole('dialog', { name: 'Log re-test result' });
    await user.type(within(dialog).getByLabelText('Your result'), '26');
    await user.click(within(dialog).getByRole('button', { name: 'Save result' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocked.logWeeklyTestResult).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('the late-test card for the open week\'s own test is unchanged', async () => {
    await renderToday();
    expect(screen.queryByRole('region', { name: "This week's test is still open" })).toBeNull();
  });
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
