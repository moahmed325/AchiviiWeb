import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider } from '../../context/GoalContext';
import * as api from '../../lib/api';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';
import type { CloseWeekAnswer, DailyTask, Goal, PastLimitChoice, RoadmapWeek, WeeklyReview } from '../../types';
import { AppShell } from '../app/AppShell';
import { Home } from '../../pages/Home';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';

// Weekly update M1.5b (RULE-8, RULE-15, WU-38 to WU-40): the choice past the limit as the app shows it. The api is
// mocked; the real GoalProvider, AppShell and Home run.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    closeWeek: vi.fn(),
    markCloseLineSeen: vi.fn(),
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    fetchBillingEntitlement: vi.fn(),
    reconcileGoal: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const tasksOf = (weekNumber: number, from: number): DailyTask[] =>
  DAYS.map(
    (dayOfWeek, index) =>
      ({
        id: `w${weekNumber}t${index + 1}`,
        goalId: 'g1',
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + index + 1,
        date: isoDay(from + index),
        dayOfWeek,
        title: `Week ${weekNumber} session ${index + 1}`,
        detailedSteps: '[]',
        implementationIntention: '',
        durationMinutes: 30,
        isRestDay: index === 6,
        isTestDay: index === 5,
        status: 'pending',
        created_at: '',
      }) as DailyTask
  );

const week = (weekNumber: number, over: Partial<RoadmapWeek> = {}) =>
  ({
    id: `w${weekNumber}`,
    goalId: 'g1',
    weekNumber,
    phase: 'Base',
    theme: `Theme ${weekNumber}`,
    status: 'pending',
    target: { kind: 'number', metric: '5 km time', value: 27, unit: 'min', direction: 'lower_is_better' },
    test: { type: 'timer', instructions: 'Run 5 km at an even, hard effort.', passIf: 'under 27 minutes' },
    testResult: null,
    ...over,
  }) as RoadmapWeek;

/** Week 2 ended 45 days ago and is still open: past the limit. */
const BEFORE = {
  id: 'g1',
  planVersion: 2,
  rawGoal: 'Run a 10K',
  clarifiedOutcome: 'Sub-50 10K',
  status: 'active',
  currentWeek: 2,
  targetDate: `${isoDay(40)}T00:00:00.000Z`,
  roadmapWeeks: [week(1, { status: 'completed', closedBy: 'review' }), week(2, { status: 'active' }), week(3), week(4), week(5), week(6)],
  dailyTasks: tasksOf(2, -52),
  weeklyReviews: [],
} as unknown as Goal;

const KEEP_LINE = 'Welcome back. Your plan picks up at week 6 and now ends on {date}.';

/** After "Keep going": weeks 3 to 5 jumped, week 6 open from today, the line on week 2. */
const AFTER = {
  ...BEFORE,
  currentWeek: 6,
  targetDate: `${isoDay(64)}T00:00:00.000Z`,
  roadmapWeeks: [
    week(1, { status: 'completed', closedBy: 'review' }),
    week(2, { status: 'completed', closedBy: 'auto', closeLineSeenAt: null }),
    ...[3, 4, 5].map((n) => week(n, { status: 'completed', closedBy: 'jumped', jumped: true })),
    week(6, { status: 'active' }),
  ],
  dailyTasks: [...tasksOf(2, -52), ...tasksOf(6, 0)],
  weeklyReviews: [{ id: 'r2', goalId: 'g1', weekNumber: 2, aiAdaptationInsight: KEEP_LINE } as WeeklyReview],
} as unknown as Goal;

const checkWith = (choice: PastLimitChoice | null, isBreak = true) => ({ due: true, weekNumber: 2, testLogged: false, break: isBreak, choice }) as CloseWeekAnswer;
const CLOSED = { due: true, closedBy: 'auto' } as unknown as CloseWeekAnswer;

let calls: string[];
let check: CloseWeekAnswer;
const router: { navigate?: NavigateFunction } = {};
const GrabNavigate = () => {
  const go = useNavigate();
  useEffect(() => {
    router.navigate = go;
  }, [go]);
  return null;
};
const Onboarding = () => {
  const location = useLocation();
  return <main id="main">Goal creation: {(location.state as { draftGoal?: string } | null)?.draftGoal}</main>;
};

const renderApp = (at = '/') =>
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter initialEntries={[at]}>
          <GrabNavigate />
          <AppShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/roadmap" element={<main id="main">Roadmap page</main>} />
              <Route path="/onboarding" element={<Onboarding />} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>
  );

const card = () => screen.findByRole('region', { name: 'Welcome back.' });
const closes = () => calls.filter((c) => c.startsWith('close:') && c !== 'close:check');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  calls = [];
  check = checkWith('keep_going');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchBillingEntitlement.mockResolvedValue({ plan: 'pro', entitled: true });
  mocked.closeWeek.mockImplementation(async (_token, mode, choice) => {
    calls.push(mode === 'check' ? 'close:check' : `close:${choice ?? 'none'}`);
    if (mode === 'check') return closes().length > 0 ? { due: false } : check;
    return CLOSED;
  });
  mocked.reconcileGoal.mockImplementation(async () => {
    calls.push('reconcile');
    return { applies: false, reason: 'no_active_goal' };
  });
  mocked.fetchActiveGoal.mockImplementation(async () => {
    calls.push('fetch');
    return closes().length > 0 ? AFTER : BEFORE;
  });
  mocked.markCloseLineSeen.mockResolvedValue({ closeLineSeenAt: new Date().toISOString() });
});

describe('the choice card past the limit (WU-38, WU-40)', () => {
  it('Today shows only the card with its exact words; nothing closes and reconcile waits', async () => {
    renderApp();
    const region = await card();
    expect(within(region).getByText('This break is longer than your plan can move. Start a fresh 12-week plan, or keep going with this one.')).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Start a fresh plan' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Keep going' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: 'Run a 10K' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: "Did you do last week's test?" })).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'fetch']);
  });

  it('past week 12 the card offers the final week', async () => {
    check = checkWith('final_week');
    renderApp();
    const region = await card();
    expect(within(region).getByText("Your plan's dates have passed. Start a fresh 12-week plan, or do your final week now.")).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Start a fresh plan' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Do my final week' })).toBeVisible();
    expect(within(region).queryByRole('button', { name: 'Keep going' })).not.toBeInTheDocument();
  });

  it('"Do my final week" sends the final week', async () => {
    const user = userEvent.setup();
    check = checkWith('final_week');
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Do my final week' }));
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(mocked.closeWeek).toHaveBeenCalledWith('t', undefined, 'final_week');
  });

  it('"Keep going" closes with the choice, then reconciles and fetches; Today shows the new week and the line once', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Keep going' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K' })).toBeVisible();
    expect(calls).toEqual(['close:check', 'fetch', 'close:keep_going', 'reconcile', 'fetch']);
    expect(mocked.closeWeek).toHaveBeenCalledWith('t', undefined, 'keep_going');
    expect(screen.getByText(/^Welcome back\. Your plan picks up at week 6 and now ends on (?!\{date\}).+\.$/)).toBeVisible();
    expect(document.querySelector('header')).toHaveTextContent(/^Week 6 · Base · Theme 6/);
    expect(screen.queryByRole('region', { name: 'Welcome back.' })).not.toBeInTheDocument();
  });

  it('a goal screen sends them to Today\'s card and closes nothing (WU-38 (1))', async () => {
    renderApp('/roadmap');
    expect(await card()).toBeVisible();
    expect(screen.queryByText('Roadmap page')).not.toBeInTheDocument();
    await act(async () => router.navigate!('/roadmap'));
    expect(await card()).toBeVisible();
    expect(closes()).toEqual([]);
  });

  it('"Start a fresh plan" opens goal creation with the goal\'s text; nothing closes; coming back shows the card', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Start a fresh plan' }));
    expect(await screen.findByText('Goal creation: Run a 10K')).toBeVisible();
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe('Run a 10K');
    await act(async () => router.navigate!('/'));
    expect(await card()).toBeVisible();
    expect(closes()).toEqual([]);
    expect(calls).not.toContain('reconcile');
  });

  it('a closed tab answers nothing: a new open shows the card again', async () => {
    const { unmount } = renderApp();
    await card();
    unmount();
    renderApp();
    expect(await card()).toBeVisible();
    expect(closes()).toEqual([]);
  });

  it('a 5xx keeps "Couldn\'t get your next week ready" with Try again, which sends the same choice', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let failing = true;
    mocked.closeWeek.mockImplementation(async (_t, mode, choice) => {
      calls.push(mode === 'check' ? 'close:check' : `close:${choice ?? 'none'}`);
      if (mode === 'check') return check;
      if (failing) throw new api.ApiError("Couldn't get your next week ready. Please try again.", 503);
      return CLOSED;
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      calls.push('fetch');
      return failing ? BEFORE : AFTER;
    });
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Keep going' }));
    const alert = (await screen.findByText("Couldn't get your next week ready. Please try again.")).closest<HTMLElement>('[role="alert"]')!;
    // The plan as stored, not reconciled.
    expect(calls).toEqual(['close:check', 'fetch', 'close:keep_going', 'fetch']);
    failing = false;
    calls = [];
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(document.querySelector('header')).toHaveTextContent(/^Week 6 · Base · Theme 6/));
    expect(calls).toEqual(['close:keep_going', 'reconcile', 'fetch']);
  });
});

describe('no test card after a break (WU-39)', () => {
  it('a break with no choice closes at once as unlogged, with no card', async () => {
    check = checkWith(null);
    renderApp();
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: "Did you do last week's test?" })).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'close:none', 'reconcile', 'fetch']);
  });

  it('a gap under 7 days still shows the test card', async () => {
    check = checkWith(null, false);
    renderApp();
    expect(await screen.findByRole('dialog', { name: "Did you do last week's test?" })).toBeVisible();
    expect(closes()).toEqual([]);
  });
});
