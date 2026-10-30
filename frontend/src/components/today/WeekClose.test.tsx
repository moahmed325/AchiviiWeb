import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider } from '../../context/GoalContext';
import * as api from '../../lib/api';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';
import type { CloseWeekAnswer, DailyTask, Goal, RoadmapWeek, WeeklyReview } from '../../types';
import { AppShell } from '../app/AppShell';
import { Home } from '../../pages/Home';

// Weekly update M1.2b (RULE-8, RULE-17, WU-28): the close as the app shows it on Today. The api is mocked; the real
// GoalProvider, AppShell and Home run. No weekly tests (2026-10-30): no close waits for a test card.

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
    ...over,
  }) as RoadmapWeek;

/** Week 1 ended yesterday and is still open: the close is due. */
const BEFORE = {
  id: 'g1',
  planVersion: 2,
  rawGoal: 'Run a 10K',
  clarifiedOutcome: 'Sub-50 10K',
  status: 'active',
  currentWeek: 1,
  targetDate: `${isoDay(77)}T00:00:00.000Z`,
  roadmapWeeks: [week(1, { status: 'active' }), week(2)],
  dailyTasks: tasksOf(1, -7),
  weeklyReviews: [],
} as unknown as Goal;

const INSIGHT = 'Next week is ready.';
const review = (weekNumber: number) => ({ id: `r${weekNumber}`, goalId: 'g1', weekNumber, aiAdaptationInsight: INSIGHT }) as WeeklyReview;

/** After the automatic close: week 2 is open, week 1 closed by `closedBy`. */
const after = (w1: Partial<RoadmapWeek> = {}): Goal =>
  ({
    ...BEFORE,
    currentWeek: 2,
    roadmapWeeks: [week(1, { status: 'completed', closedBy: 'auto', closeLineSeenAt: null, ...w1 }), week(2, { status: 'active' })],
    dailyTasks: [...tasksOf(1, -7), ...tasksOf(2, 0)],
    weeklyReviews: [review(1)],
  }) as unknown as Goal;

const CHECK_DUE = { due: true, weekNumber: 1 } as CloseWeekAnswer;
const CLOSED = { due: true, closedBy: 'auto' } as unknown as CloseWeekAnswer;

/** The close call (no mode) waits until the returned function is called. Records the order like the default. */
function holdClose(check: CloseWeekAnswer = CHECK_DUE) {
  let release!: () => void;
  const done = new Promise<void>((resolve) => (release = resolve));
  mocked.closeWeek.mockImplementation(async (_token, mode) => {
    calls.push(mode === 'check' ? 'close:check' : 'close');
    if (mode === 'check') return calls.includes('close') ? { due: false } : check;
    await done;
    return CLOSED;
  });
  return () => act(async () => release());
}

/** Every api call in order, as `close:check`, `close`, `reconcile` and `fetch`. */
let calls: string[];
const renderApp = () =>
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter initialEntries={['/']}>
          <AppShell>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/progress" element={<main id="main">Progress page</main>} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>
  );


beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  calls = [];
  let closed = false;
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchBillingEntitlement.mockResolvedValue({ plan: 'pro', entitled: true });
  mocked.closeWeek.mockImplementation(async (_token, mode) => {
    if (mode === 'check') return closed ? { due: false } : CHECK_DUE;
    closed = true;
    return CLOSED;
  });
  mocked.reconcileGoal.mockImplementation(async () => {
    calls.push('reconcile');
    return { applies: false, reason: 'no_active_goal' };
  });
  mocked.fetchActiveGoal.mockImplementation(async () => {
    calls.push('fetch');
    return calls.includes('close') ? after() : BEFORE;
  });
  mocked.markCloseLineSeen.mockResolvedValue({ closeLineSeenAt: new Date().toISOString() });
  // Record the order on top of each test's own closeWeek answers.
  const original = mocked.closeWeek.getMockImplementation()!;
  mocked.closeWeek.mockImplementation(async (token, mode) => {
    calls.push(mode === 'check' ? 'close:check' : 'close');
    return original(token, mode);
  });
});

describe('a due close (no weekly tests)', () => {
  it('closes at once with no card: the close, then reconcile and the fetch', async () => {
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
  });
});

describe('getting ready, a failed close and the line once (RULE-8, RULE-9, WU-28)', () => {
  it('a due close shows "Getting your next week ready…" while the week is written', async () => {
    const release = holdClose({ due: true, weekNumber: 1 } as CloseWeekAnswer);
    renderApp();
    expect(await screen.findByText('Getting your next week ready…')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await release();
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K' })).toBeVisible();
    expect(screen.queryByText('Getting your next week ready…')).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
  });

  it('a 503 shows the failure state over the plan as stored; Try again closes, reconciles and fetches', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let failing = true;
    mocked.closeWeek.mockImplementation(async (_t, mode) => {
      calls.push(mode === 'check' ? 'close:check' : 'close');
      if (mode === 'check') return { due: true, weekNumber: 1 };
      if (failing) throw new api.ApiError("Couldn't get your next week ready. Please try again.", 503);
      return CLOSED;
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      calls.push('fetch');
      return failing ? BEFORE : after();
    });
    renderApp();
    const alert = (await screen.findByText("Couldn't get your next week ready. Please try again.")).closest<HTMLElement>('[role="alert"]')!;
    expect(alert).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Run a 10K' })).toBeVisible();
    // The plan as stored: still week 1.
    expect(document.querySelector('header')).toHaveTextContent(/Week 1 · BaseRun a 10K/);
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);

    failing = false;
    calls = [];
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText("Couldn't get your next week ready. Please try again.")).not.toBeInTheDocument());
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    await waitFor(() => expect(document.querySelector('header')).toHaveTextContent(/Week 2 · BaseRun a 10K/));
  });

  it('after an automatic close Today shows the line once; dismissing records it', async () => {
    const user = userEvent.setup();
    mocked.closeWeek.mockResolvedValue({ due: false });
    mocked.fetchActiveGoal.mockResolvedValue(after());
    renderApp();
    expect(await screen.findByText(INSIGHT)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(INSIGHT)).not.toBeInTheDocument();
    expect(mocked.markCloseLineSeen).toHaveBeenCalledTimes(1);
    expect(mocked.markCloseLineSeen).toHaveBeenCalledWith(1, 't');
  });

  it.each([
    ['seen on another device', { closeLineSeenAt: '2026-10-17T08:00:00.000Z' }],
    ['closed by the review', { closedBy: 'review' as const }],
    ['closed before the feature', { closedBy: null }],
  ])('no line for a week %s', async (_name, w1) => {
    mocked.closeWeek.mockResolvedValue({ due: false });
    mocked.fetchActiveGoal.mockResolvedValue(after(w1));
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(screen.queryByText(INSIGHT)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('switch off: no card, no getting ready, no line; reconcile and the fetch run as before', async () => {
    mocked.closeWeek.mockImplementation(async (_t, mode) => {
      calls.push(mode === 'check' ? 'close:check' : 'close');
      return { due: false };
    });
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(calls).toEqual(['close:check', 'reconcile', 'fetch']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Getting your next week ready…')).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't get your next week ready. Please try again.")).not.toBeInTheDocument();
  });
});
