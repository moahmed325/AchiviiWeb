import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { GoalProvider } from '../../context/GoalContext';
import * as api from '../../lib/api';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';
import type { CloseWeekAnswer, DailyTask, Goal, RoadmapWeek, WeeklyReview } from '../../types';
import { AppShell } from '../app/AppShell';
import { Home } from '../../pages/Home';

// Weekly update M1.2b (RULE-8, RULE-17, WU-14, WU-28): the close as the app shows it on Today. The api is mocked; the
// real GoalProvider, AppShell and Home run.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    closeWeek: vi.fn(),
    markCloseLineSeen: vi.fn(),
    logWeeklyTestResult: vi.fn(),
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

const INSIGHT = 'Next week is ready. Your targets stay as planned.';
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

const CHECK_DUE = { due: true, weekNumber: 1, testLogged: false } as CloseWeekAnswer;
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

/** Every api call in order, as `close:check`, `close`, `test-result`, `reconcile` and `fetch`. */
let calls: string[];
/** The router's navigate, kept after render, so a test can go to another screen while the card's dialog is open. */
const router: { navigate?: NavigateFunction } = {};
const navigate = (to: string) => router.navigate!(to);
const GrabNavigate = () => {
  const go = useNavigate();
  useEffect(() => {
    router.navigate = go;
  }, [go]);
  return null;
};

const renderApp = () =>
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter initialEntries={['/']}>
          <GrabNavigate />
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

const card = () => screen.findByRole('dialog', { name: "Did you do last week's test?" });
const closes = () => calls.filter((c) => c === 'close').length;

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
  mocked.logWeeklyTestResult.mockImplementation(async () => {
    calls.push('test-result');
    return { testResult: { value: 26, passed: true } };
  });
  mocked.markCloseLineSeen.mockResolvedValue({ closeLineSeenAt: new Date().toISOString() });
  // Record the order on top of each test's own closeWeek answers.
  const original = mocked.closeWeek.getMockImplementation()!;
  mocked.closeWeek.mockImplementation(async (token, mode) => {
    calls.push(mode === 'check' ? 'close:check' : 'close');
    return original(token, mode);
  });
});

describe('the test card (WU-14, WU-28)', () => {
  it('a due close with no logged test: Today shows only the card, and reconcile waits', async () => {
    renderApp();
    const dialog = await card();
    expect(within(dialog).getByText('Log your result to shape next week.')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Log result' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Skip' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: 'Run a 10K' })).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'fetch']);
  });

  it('Skip closes the week at once as unlogged, then reconciles and fetches', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Skip' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Run a 10K' })).toBeVisible();
    expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
    expect(mocked.logWeeklyTestResult).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dismissing the card (Escape) counts as Skip', async () => {
    const user = userEvent.setup();
    renderApp();
    await card();
    await user.keyboard('{Escape}');
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
  });

  it('Log result opens the entry; saving logs the result, then closes the week with it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    expect(within(entry).getByText('Run 5 km at an even, hard effort.')).toBeVisible();
    await user.type(within(entry).getByLabelText('Your result'), '26');
    await user.click(within(entry).getByRole('button', { name: 'Save result' }));
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(mocked.logWeeklyTestResult).toHaveBeenCalledWith(1, expect.objectContaining({ value: 26 }), 't');
    expect(calls).toEqual(['close:check', 'fetch', 'test-result', 'close', 'reconcile', 'fetch']);
  });

  it('Escape on the entry goes back to the card (WU-32); Escape on the card is still Skip', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    await screen.findByRole('dialog', { name: "Log last week's test" });
    await user.keyboard('{Escape}');
    expect(await card()).toBeVisible();
    expect(closes()).toBe(0);
    await user.keyboard('{Escape}');
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
  });

  it('a tap outside the entry goes back to the card (WU-32)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    await screen.findByRole('dialog', { name: "Log last week's test" });
    // Radix closes a dialog on a pointer down and click outside its content; it listens a tick after the content mounts.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    const overlay = document.querySelector<HTMLElement>('[data-state="open"].fixed.inset-0')!;
    fireEvent.pointerDown(overlay);
    fireEvent.pointerUp(overlay);
    fireEvent.click(overlay);
    expect(await card()).toBeVisible();
    expect(closes()).toBe(0);
  });

  it("the entry's Skip closes the week as unlogged", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    await user.click(within(entry).getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
  });

  it('a new token while the card is open keeps the card and the typed result, and sends no second close (review fix 2)', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    await user.type(within(entry).getByLabelText('Your result'), '26');
    const authCalls = vi.mocked(supabase!.auth.onAuthStateChange).mock.calls;
    const onChange = authCalls[authCalls.length - 1][0];
    await act(async () => onChange('TOKEN_REFRESHED', { access_token: 't2' } as never));
    await waitFor(() => expect(mocked.fetchCurrentUser).toHaveBeenCalledWith('t2'));
    expect(screen.getByRole('dialog', { name: "Log last week's test" })).toBeVisible();
    expect(within(entry).getByLabelText('Your result')).toHaveValue('26');
    expect(calls).toEqual(['close:check', 'fetch']);

    await user.click(within(entry).getByRole('button', { name: 'Save result' }));
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(calls).toEqual(['close:check', 'fetch', 'test-result', 'close', 'reconcile', 'fetch']);
    expect(mocked.closeWeek).toHaveBeenLastCalledWith('t2');
  });

  it('a result that fails to save keeps the entry open and closes nothing; Skip still works', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.logWeeklyTestResult.mockRejectedValueOnce(new api.ApiError('Failed', 500));
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    await user.type(within(entry).getByLabelText('Your result'), '26');
    await user.click(within(entry).getByRole('button', { name: 'Save result' }));
    expect(await within(entry).findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
    expect(closes()).toBe(0);
    await user.click(within(entry).getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(closes()).toBe(1);
  });

  it('going to another screen counts as Skip', async () => {
    renderApp();
    await card();
    await act(async () => navigate('/progress'));
    expect(await screen.findByText('Progress page')).toBeVisible();
    await waitFor(() => expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']));
  });

  it('only one close is sent: Skip, then dismissing and leaving while it runs, send nothing more', async () => {
    const user = userEvent.setup();
    const release = holdClose();
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Skip' }));
    await act(async () => navigate('/progress'));
    await act(async () => navigate('/'));
    await release();
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(closes()).toBe(1);
  });

  it('leaving Today while the result saves sends no Skip: the week closes once, with the result', async () => {
    const user = userEvent.setup();
    let saved!: () => void;
    mocked.logWeeklyTestResult.mockImplementation(async () => {
      await new Promise<void>((resolve) => (saved = resolve));
      calls.push('test-result');
      return { testResult: { value: 26, passed: true } };
    });
    renderApp();
    await user.click(within(await card()).getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    await user.type(within(entry).getByLabelText('Your result'), '26');
    await user.click(within(entry).getByRole('button', { name: 'Save result' }));
    await act(async () => navigate('/progress'));
    expect(closes()).toBe(0);
    await act(async () => saved());
    await waitFor(() => expect(calls).toEqual(['close:check', 'fetch', 'test-result', 'close', 'reconcile', 'fetch']));
  });

  it('a closed tab answers nothing: a new open shows the card again', async () => {
    const first = renderApp();
    await card();
    first.unmount();
    renderApp();
    await card();
    expect(closes()).toBe(0);
  });

  it('a week with no test to log closes at once, with no card', async () => {
    const noTest = { ...BEFORE, roadmapWeeks: [week(1, { status: 'active', test: null }), week(2)] } as unknown as Goal;
    mocked.fetchActiveGoal.mockImplementation(async () => {
      calls.push('fetch');
      return calls.includes('close') ? after() : noTest;
    });
    renderApp();
    await screen.findByRole('heading', { level: 1, name: 'Run a 10K' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
  });
});

describe('getting ready, a failed close and the line once (RULE-8, RULE-9, WU-28)', () => {
  it('a logged test closes at once and shows "Getting your next week ready…" while the week is written', async () => {
    const release = holdClose({ due: true, weekNumber: 1, testLogged: true });
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
      if (mode === 'check') return { due: true, weekNumber: 1, testLogged: true };
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
    expect(document.querySelector('header')).toHaveTextContent(/^Week 1 · Base · Theme 1/);
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);

    failing = false;
    calls = [];
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText("Couldn't get your next week ready. Please try again.")).not.toBeInTheDocument());
    expect(calls).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    await waitFor(() => expect(document.querySelector('header')).toHaveTextContent(/^Week 2 · Base · Theme 2/));
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
