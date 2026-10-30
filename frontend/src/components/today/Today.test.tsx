import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal, MissedSignals, Reconciliation } from '../../types';
import { Today } from './Today';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    // Weekly update M1.2b: the load asks to close a week first; the switch-off answer, so no test reaches the network.
    closeWeek: vi.fn(async () => ({ due: false as const })),
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn().mockResolvedValue({ applies: false, reason: 'no_active_goal' }),
    updateDailyTask: vi.fn(),
    markTodayMissed: vi.fn(),
    swapDays: vi.fn(),
    carryNow: vi.fn(),
  };
});

const mocked = vi.mocked(api);
// Task dates are the user's local calendar days (ND-1), so build them on the same clock the app reads.
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STEPS = JSON.stringify([
  { stepNumber: 1, title: 'Warm up', durationMinutes: 10, instructions: 'Jog gently for ten minutes.', focusCue: 'Nose breathing.' },
  { stepNumber: 2, title: 'Steady run', durationMinutes: 25, instructions: 'Hold an easy pace.', focusCue: 'Relaxed shoulders.' },
]);

const tasks: DailyTask[] = DAYS.map(
  (dayOfWeek, index) =>
    ({
      id: `t${index + 1}`,
      goalId: 'g1',
      weekNumber: 1,
      dayNumber: index + 1,
      date: isoDay(index - 2),
      dayOfWeek,
      title: index === 2 ? 'Easy base run' : `Session ${index + 1}`,
      detailedSteps: STEPS,
      implementationIntention: '',
      durationMinutes: 30,
      slotTime: '19:30',
      isRestDay: index === 6,
      status: index < 2 ? 'completed' : 'pending',
      created_at: '',
    }) as DailyTask,
);

const GOAL = {
  id: 'g1',
  rawGoal: 'Run a 10K Under 50 Minutes',
  clarifiedOutcome: '49.98',
  currentWeek: 1,
  targetDate: `${isoDay(88)}T00:00:00.000Z`,
  roadmapWeeks: [{ weekNumber: 1, phase: 'Aerobic base', theme: 'Easy miles' }],
  dailyTasks: tasks,
} as unknown as Goal;

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
  return screen.findByRole('heading', { level: 1 });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(GOAL);
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
  mocked.updateDailyTask.mockImplementation(async (id, updates) => ({ ...tasks.find((t) => t.id === id)!, ...updates }) as DailyTask);
});

/** ND-30: opens every step on today's card, so its details are on screen. */
const openAllSteps = async () => {
  const list = screen.getByRole('list', { name: 'Steps in this session' });
  for (const button of within(list).getAllByRole('button')) {
    if (button.getAttribute('aria-expanded') === 'false') await userEvent.click(button);
  }
};

describe('Today', () => {
  it('ND-30: one line of where you are, then the goal the user chose; never the stored outcome', async () => {
    const heading = await renderToday();
    expect(heading).toHaveTextContent('Run a 10K Under 50 Minutes');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByText(/49\.98/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Day 3 of 90')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Day 3 of 90 · Week 1 · Aerobic base')).toBeInTheDocument();
  });

  it('shows no fixed-date line for a goal without one (B-106)', async () => {
    await renderToday();
    expect(screen.queryByText(/Your date:/)).not.toBeInTheDocument();
  });

  it('shows a fixed date next to the plan end (B-106)', async () => {
    mocked.fetchActiveGoal.mockResolvedValue({ ...GOAL, fixedDate: `${isoDay(120)}T00:00:00.000Z` } as Goal);
    await renderToday();
    expect(screen.getByText(/^Your date: .+\. Your plan ends on .+\.$/)).toBeInTheDocument();
  });

  it("shows today's step, its duration and slot, and the week as practice days", async () => {
    await renderToday();
    const step = screen.getByRole('region', { name: 'Easy base run' });
    expect(within(step).getByText("Today's step")).toBeInTheDocument();
    expect(within(step).getByText('30 min · 2 steps · at 19:30')).toBeInTheDocument();
    // ND-30: the steps are on the card from the start, each opening in place.
    const list = within(step).getByRole('list', { name: 'Steps in this session' });
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false']);
    expect(screen.getByText('2 of 6 practice days done')).toBeInTheDocument();
  });

  it('Start opens focus mode for this step', async () => {
    await renderToday();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('button', { name: 'Exit focus mode (Esc)' })).toBeInTheDocument();
  });

  // ND-3: only Focus mode's "Complete minimum" records the 10-minute version.
  const MINIMUM = { stepNumber: 1, title: '10-minute shakeout', durationMinutes: 10, instructions: 'Jog easily.', focusCue: '', pitfallToAvoid: '' };
  const renderTodayWithMinimum = () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce({
      ...GOAL,
      dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, minimumVersion: MINIMUM } : t)),
    } as unknown as Goal);
    return renderToday();
  };

  it('a Focus "Complete minimum" sends usedMinimumVersion with the completion', async () => {
    const user = userEvent.setup();
    await renderTodayWithMinimum();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: /start focused session/i }));
    await user.click(screen.getByRole('button', { name: /low energy/i }));
    await user.click(screen.getByRole('button', { name: /complete minimum/i }));
    expect(screen.getByText(/10-minute version done · Session 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /finish & return/i }));
    expect(mocked.updateDailyTask).toHaveBeenCalledTimes(1);
    expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { status: 'completed', notes: undefined, usedMinimumVersion: true }, 't');
  });

  it('a full Focus completion sends no usedMinimumVersion, even when a minimum version exists', async () => {
    const user = userEvent.setup();
    await renderTodayWithMinimum();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: /start focused session/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /complete session/i }));
    await user.click(screen.getByRole('button', { name: /finish & return/i }));
    expect(mocked.updateDailyTask).toHaveBeenCalledTimes(1);
    expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { status: 'completed', notes: undefined }, 't');
  });

  it("Today's Complete sends no usedMinimumVersion, even when a minimum version exists", async () => {
    const user = userEvent.setup();
    await renderTodayWithMinimum();
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { status: 'completed', notes: undefined }, 't');
  });

  it('Complete goes through the write path, and a failure says so and keeps the step as it was', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { status: 'completed', notes: undefined }, 't');
    expect(await screen.findByRole('button', { name: 'Mark not done' })).toBeInTheDocument();

    mocked.updateDailyTask.mockRejectedValueOnce(new Error('Failed to fetch'));
    await user.click(screen.getByRole('button', { name: 'Mark not done' }));
    expect(await screen.findByText("That didn't save. Please check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeInTheDocument();
  });

  it('a step opens in place to show its instruction and focus cue', async () => {
    await renderToday();
    const step = screen.getByRole('button', { name: /Warm up/ });
    expect(step).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Jog gently for ten minutes.')).not.toBeVisible();
    await userEvent.click(step);
    expect(step).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Jog gently for ten minutes.')).toBeVisible();
    expect(screen.getByText('Nose breathing.')).toBeVisible();
    // Several can be open at once.
    await userEvent.click(screen.getByRole('button', { name: /Steady run/ }));
    expect(screen.getByText('Jog gently for ten minutes.')).toBeVisible();
    expect(screen.getByText('Hold an easy pace.')).toBeVisible();
  });

  it('a saved note goes with the completion', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    await user.type(screen.getByLabelText('Notes for this step'), 'Legs felt heavy');
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { notes: 'Legs felt heavy' }, 't'));
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    await waitFor(() =>
      expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t3', { status: 'completed', notes: 'Legs felt heavy' }, 't'),
    );
  });

  it('limits a new note to 2,000 characters and shows the count near the limit (B-29)', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    const box = screen.getByLabelText('Notes for this step');
    expect(box).toHaveAttribute('maxLength', '2000');
    expect(screen.queryByText(/of 2,000 characters/)).not.toBeInTheDocument();

    await user.click(box);
    await user.paste('x'.repeat(2000));
    expect(box).toHaveAccessibleDescription("2,000 of 2,000 characters. That's the limit.");
  });

  it("choosing another day shows that day's step", async () => {
    await renderToday();
    const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
    const thursday = days.find((b) => b.getAttribute('aria-label')?.startsWith('Thu'))!;
    await userEvent.click(thursday);
    expect(screen.getByRole('region', { name: 'Session 4' })).toBeInTheDocument();
    expect(screen.getByText("Thursday's step")).toBeInTheDocument();
    expect(thursday).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows whyToday on screen, reveals all detailed step fields, 10-minute version, implementation intention, and task resource on demand', async () => {
    const richSteps = JSON.stringify([
      {
        stepNumber: 1,
        title: 'Warm up drill',
        durationMinutes: 10,
        instructions: 'Jog gently then dynamic stretches.',
        focusCue: 'Nose breathing.',
        passMark: 'Complete 10 min without stopping.',
        output: 'Elevated heart rate.',
        pitfallToAvoid: 'Sprinting early.',
        timing: '5 min after waking',
        resourceTitle: 'Dynamic Warmup Video',
        resourceUrl: 'https://example.com/warmup',
        resourceWhy: 'Primes mobility',
      },
      {
        stepNumber: 2,
        title: 'Steady pace',
        durationMinutes: 20,
        instructions: 'Maintain base rhythm.',
      },
    ]);

    const richTask: DailyTask = {
      ...tasks[2],
      whyToday: 'Aerobic base running trains fat oxidation.',
      detailedSteps: richSteps,
      implementationIntention: 'When: 7:00 AM | Where: Park trail | Action: Run steadily',
      minimumVersion: {
        stepNumber: 1,
        title: '10-minute shakeout',
        durationMinutes: 10,
        instructions: '10 minutes easy jog around the block.',
        passMark: 'Finish continuous 10 min.',
        focusCue: '',
        pitfallToAvoid: '',
      },
      resourceTitle: 'Pacing Strategy',
      resourceUrl: 'https://example.com/pacing',
      resourceType: 'guide',
      resourceWhy: 'Helps prevent late fade',
    };

    const richGoal = {
      ...GOAL,
      dailyTasks: tasks.map((t) => (t.id === 't3' ? richTask : t)),
    } as unknown as Goal;

    mocked.fetchActiveGoal.mockResolvedValueOnce(richGoal);
    await renderToday();

    // 1. whyToday is on screen without any reveal opened, and no fallback text
    expect(screen.getByText('Aerobic base running trains fat oxidation.')).toBeVisible();
    expect(screen.queryByText(/Follow the deliberate practice steps/)).not.toBeInTheDocument();

    // 2. Step fields hidden until the step is opened (ND-30)
    expect(screen.queryByText('Complete 10 min without stopping.')).not.toBeVisible();
    await openAllSteps();
    // Step 1: all optional fields present with their labels
    expect(screen.getByText('Complete 10 min without stopping.')).toBeVisible();
    expect(screen.getByText('Elevated heart rate.')).toBeVisible();
    expect(screen.getByText('Sprinting early.')).toBeVisible();
    expect(screen.getByText('5 min after waking')).toBeVisible();
    const stepLink = screen.getByRole('link', { name: /Dynamic Warmup Video/ });
    expect(stepLink).toHaveAttribute('href', 'https://example.com/warmup');
    expect(screen.getByText('Primes mobility')).toBeVisible();

    // Step 2: empty optional fields omit their labels
    const step2 = screen.getByText('Steady pace').closest('li')!;
    expect(within(step2).queryByText(/Done when:/)).not.toBeInTheDocument();
    expect(within(step2).queryByText(/Output:/)).not.toBeInTheDocument();
    expect(within(step2).queryByText(/Pitfall:/)).not.toBeInTheDocument();
    expect(within(step2).queryByText(/Timing:/)).not.toBeInTheDocument();
    expect(within(step2).queryByText(/Resource:/)).not.toBeInTheDocument();

    // 3. ND-30: the 10-minute version, when and where, and the resource share one closed "More" row
    const moreReveal = screen.getByRole('button', { name: 'The 10-minute version · When and where · Resource' });
    expect(moreReveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('10-minute shakeout')).not.toBeVisible();
    await userEvent.click(moreReveal);
    expect(screen.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('10-minute shakeout')).toBeVisible();
    expect(screen.getByText('10 minutes easy jog around the block.')).toBeVisible();
    expect(screen.getByText('Finish continuous 10 min.')).toBeVisible();
    // Only one Start button on screen (from the main step, not inside the 10-minute version)
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1);

    // 4. When and where
    expect(screen.getByText('7:00 AM')).toBeVisible();
    expect(screen.getByText('Park trail')).toBeVisible();
    expect(screen.getByText('Run steadily')).toBeVisible();

    // 5. Task-level resource
    const taskLink = screen.getByRole('link', { name: /Pacing Strategy/ });
    expect(taskLink).toHaveAttribute('href', 'https://example.com/pacing');
    expect(screen.getByText('guide')).toBeVisible();
    expect(screen.getByText('Helps prevent late fade')).toBeVisible();
  });

  it('omits extra reveals when optional session fields are absent (M5.3 layout preserved)', async () => {
    // Default GOAL tasks have empty whyToday, implementationIntention, minimumVersion, resourceTitle
    await renderToday();
    expect(screen.queryByRole('button', { name: /10-minute version/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /When and where/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resource/i })).not.toBeInTheDocument();
  });

  it('renders raw implementation intention when not partitioned into when/where/action', async () => {
    const rawTask: DailyTask = {
      ...tasks[2],
      implementationIntention: 'Just put on running shoes and head out right away.',
    };
    const rawGoal = {
      ...GOAL,
      dailyTasks: tasks.map((t) => (t.id === 't3' ? rawTask : t)),
    } as unknown as Goal;

    mocked.fetchActiveGoal.mockResolvedValueOnce(rawGoal);
    await renderToday();

    await userEvent.click(screen.getByRole('button', { name: 'When and where' }));
    expect(screen.getByText('Just put on running shoes and head out right away.')).toBeVisible();
    expect(screen.queryByText('When')).not.toBeInTheDocument();
  });

  it('ND-30: no footer links (the app navigation has Roadmap) and no full day view link (OD-3)', async () => {
    await renderToday();
    expect(screen.queryByRole('navigation', { name: 'More of your plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open full day view' })).not.toBeInTheDocument();
    expect(screen.queryByText(/The full day view shows/i)).not.toBeInTheDocument();
  });

  it('lights up completed step with quiet confirmation, shows next step preview, and reverts cleanly', async () => {
    const user = userEvent.setup();
    await renderToday();

    // Initially pending: no completion confirmation, no next step preview
    expect(screen.queryByText('Session 3 is in the books.')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow · Thursday')).not.toBeInTheDocument();

    // Mark complete
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));

    // 1. Completed step lighting & quiet confirmation
    expect(screen.getByText('Session 3 is in the books.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeVisible();

    // 2. Next step preview card appears
    expect(screen.getByText('Tomorrow · Thursday')).toBeVisible();
    expect(screen.getByText('Session 4')).toBeVisible();

    // 3. Click "View Thursday's step" navigates to Thursday
    await user.click(screen.getByRole('button', { name: "View Thursday's step" }));
    expect(screen.getByRole('region', { name: 'Session 4' })).toBeInTheDocument();

    // Switch back to Wednesday
    const wedBtn = screen.getAllByRole('button', { pressed: false }).find((b) => b.getAttribute('aria-label')?.startsWith('Wed'))!;
    await user.click(wedBtn);

    // Revert completion
    await user.click(screen.getByRole('button', { name: 'Mark not done' }));
    expect(screen.queryByText('Session 3 is in the books.')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow · Thursday')).not.toBeInTheDocument();
  });

  it('displays week completion bridge when the final practice task of the week is completed', async () => {
    const user = userEvent.setup();
    // Saturday (the last practice day, t6) is today; Sunday's rest is still ahead.
    const week = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 5), status: idx < 5 ? ('completed' as const) : ('pending' as const) }));
    mocked.fetchActiveGoal.mockResolvedValueOnce({ ...GOAL, dailyTasks: week } as unknown as Goal);
    mocked.updateDailyTask.mockImplementation(async (id, updates) => ({ ...week.find((t) => t.id === id)!, ...updates }) as DailyTask);
    await renderToday();
    expect(screen.getByRole('region', { name: 'Session 6' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark complete' }));

    // The week closes on its own after its last day; nothing to review by hand.
    expect(screen.getByText('Week 1 practice complete.')).toBeVisible();
    expect(screen.getByText('Next week opens after Sunday.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
  });

  it('shows where a moved step came from, on the day it landed', async () => {
    const [first, second] = JSON.parse(STEPS);
    const moved = JSON.stringify([first, { ...second, title: 'Hill repeats', carriedFrom: { taskId: 't2', date: tasks[1].date, replaced: [] } }]);
    mocked.fetchActiveGoal.mockResolvedValueOnce({ ...GOAL, dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, detailedSteps: moved } : t)) } as unknown as Goal);
    await renderToday();

    const from = new Date(`${tasks[1].date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    expect(screen.getByText(`Includes a step from ${from}`)).toBeVisible();
    expect(screen.getByText(`From ${from}`)).toBeVisible();
  });

  it('shows a day still ahead as a preview: no Start and no Mark complete', async () => {
    const user = userEvent.setup();
    await renderToday();
    const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
    await user.click(days.find((b) => b.getAttribute('aria-label')?.startsWith('Thu'))!);

    expect(screen.getByText("Thursday's step")).toBeVisible();
    expect(screen.getByText('This step opens on Thursday. You can read it now and do it on the day.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
  });

  it('displays focus wins separately from freeform notes and preserves both on save', async () => {
    const user = userEvent.setup();
    const taskWithWins: DailyTask = {
      ...tasks[2],
      notes: 'Felt tired in legs\n• Focus win: Kept cadence at 180 spm',
    };
    const goalWithWins = {
      ...GOAL,
      dailyTasks: tasks.map((t) => (t.id === 't3' ? taskWithWins : t)),
    } as unknown as Goal;

    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithWins);
    await renderToday();

    // Open Notes
    await user.click(screen.getByRole('button', { name: 'Notes' }));

    // Focus win is displayed as structured item
    expect(screen.getByText('Focus wins logged')).toBeVisible();
    expect(screen.getByText('Kept cadence at 180 spm')).toBeVisible();

    // Freeform notes textarea only has freeform text
    const textarea = screen.getByLabelText('Notes for this step');
    expect(textarea).toHaveValue('Felt tired in legs');

    // Add text and save
    await user.type(textarea, ' and hydrated');
    await user.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() =>
      expect(mocked.updateDailyTask).toHaveBeenCalledWith(
        't3',
        { notes: 'Felt tired in legs and hydrated\n• Focus win: Kept cadence at 180 spm' },
        't',
      ),
    );
  });

  it('renders rest day state with intentional adaptation copy, suppressed start button, recovery toggle, and next step preview', async () => {
    const user = userEvent.setup();
    // Sunday (the rest day) is today.
    const week = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 6), status: idx < 6 ? ('completed' as const) : ('pending' as const) }));
    mocked.fetchActiveGoal.mockResolvedValueOnce({ ...GOAL, dailyTasks: week } as unknown as Goal);
    mocked.updateDailyTask.mockImplementation(async (id, updates) => ({ ...week.find((t) => t.id === id)!, ...updates }) as DailyTask);
    await renderToday();

    // Eyebrow, and plain words: nothing to do
    expect(screen.getByText("Today's rest")).toBeVisible();
    expect(screen.getByText("Nothing to do today. Rest is part of the plan: it's when the practice settles in.")).toBeVisible();

    // Start (focus mode) button is suppressed on rest days
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();

    // Logging the rest is optional and quiet
    const recoveryBtn = screen.getByRole('button', { name: 'Log your rest' });
    expect(recoveryBtn).toBeVisible();

    await user.click(recoveryBtn);
    expect(screen.getByText('Rest logged')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeVisible();
  });

  it('renders key session state with its badge and no filler callout (ND-30)', async () => {
    const keyTask: DailyTask = { ...tasks[2], isKeySession: true };
    const goalWithKey = { ...GOAL, dailyTasks: tasks.map((t) => (t.id === 't3' ? keyTask : t)) } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithKey);
    await renderToday();

    expect(screen.getByText('Key session')).toBeVisible();
    expect(screen.queryByText(/pivotal session/)).not.toBeInTheDocument();
    // Start button still available
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  it("an older goal's stored test day shows as an ordinary session: no badge and no check card (no weekly tests)", async () => {
    const testTask: DailyTask = { ...tasks[2], isTestDay: true };
    const goalWithTest = {
      ...GOAL,
      roadmapWeeks: [
        {
          weekNumber: 1,
          phase: 'Aerobic base',
          theme: 'Easy miles',
          test: { type: '5K', instructions: 'Run 5K at maximum sustainable effort on a flat course.', passIf: 'finish in under 25:00' },
        },
      ],
      dailyTasks: tasks.map((t) => (t.id === 't3' ? testTask : t)),
    } as unknown as Goal;

    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithTest);
    await renderToday();

    expect(screen.queryByText('Test day')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Today's check" })).not.toBeInTheDocument();
    expect(screen.queryByText('Run 5K at maximum sustainable effort on a flat course.')).not.toBeInTheDocument();
  });

  it('after a done session, one optional tap for how it felt saves it; the tap goes when the session is marked not done', async () => {
    const user = userEvent.setup();
    // As the server does: each write starts from the stored row; marking a session not done clears its feel.
    const stored = new Map(tasks.map((t) => [t.id, t]));
    mocked.updateDailyTask.mockImplementation(async (id, updates) => {
      const next = { ...stored.get(id)!, ...updates, ...(updates.status === 'pending' ? { feel: null } : {}) } as DailyTask;
      stored.set(id, next);
      return next;
    });
    await renderToday();
    expect(screen.queryByRole('group', { name: 'How did it feel?' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    const group = screen.getByRole('group', { name: 'How did it feel?' });
    await user.click(within(group).getByRole('radio', { name: 'Too hard' }));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t3', { feel: 'too_hard' }, 't');
    expect(await screen.findByText(/Thanks. Next week takes it into account./)).toBeVisible();
    expect(within(group).getByRole('radio', { name: 'Too hard' })).toBeChecked();

    // "Add a note" opens the day's notes.
    await user.click(screen.getByRole('button', { name: 'Add a note' }));
    expect(screen.getByLabelText('Notes for this step')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Mark not done' }));
    expect(screen.queryByRole('group', { name: 'How did it feel?' })).not.toBeInTheDocument();
  });

  it('no longer shows the old generic recovery callout when yesterday was left pending', async () => {
    // Yesterday (t2) is pending and reconcile says nothing (applies: false).
    const tasksWithYesterdayPending = tasks.map((t) => (t.id === 't2' ? { ...t, status: 'pending' as const } : t));
    mocked.fetchActiveGoal.mockResolvedValueOnce({ ...GOAL, dailyTasks: tasksWithYesterdayPending } as unknown as Goal);
    await renderToday();

    expect(screen.queryByText("Yesterday's step wasn't completed")).not.toBeInTheDocument();
    expect(screen.queryByText(/Here's how we can recover/)).not.toBeInTheDocument();
    expect(screen.queryByText(/didn't happen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/behind/i)).not.toBeInTheDocument();
  });

  describe('miss notice from reconcile (missed sessions M3.1)', () => {
    const weekday = (offset: number) => new Date(`${isoDay(offset)}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
    const reconciled = (signals: Partial<MissedSignals>) =>
      mocked.reconcileGoal.mockResolvedValue({
        applies: true,
        goalId: 'g1',
        asOf: new Date().toISOString(),
        timezone: 'UTC',
        days: [],
        gap: null,
        carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
        signals: { ...NONE, ...signals },
      });
    const carriedFrom = (from: number, to: number) => ({ fromDate: isoDay(from), fromTaskId: 'x', toDate: isoDay(to), toTaskId: 'y', stepTitle: 'Lead' });
    const lines = () => screen.queryAllByText(/session didn't happen/);
    const expectCalmCopy = () => {
      const text = document.body.textContent ?? '';
      for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
    };

    it('carried into today, from yesterday', async () => {
      reconciled({ notice: 'carried', carried: [carriedFrom(-1, 0)] });
      await renderToday();
      expect(
        screen.getByText("Yesterday's session didn't happen. We moved its most important step into today, so today stays the same length."),
      ).toBeVisible();
      expect(lines()).toHaveLength(1);
      expectCalmCopy();
    });

    it('carried to a later day, from an earlier weekday', async () => {
      reconciled({ notice: 'carried', carried: [carriedFrom(-2, 1)] });
      await renderToday();
      expect(
        screen.getByText(
          `${weekday(-2)}'s session didn't happen. We moved its most important step to ${weekday(1)}, so that day stays the same length.`,
        ),
      ).toBeVisible();
      expectCalmCopy();
    });

    it('carried into today from an earlier weekday', async () => {
      reconciled({ notice: 'carried', carried: [carriedFrom(-2, 0)] });
      await renderToday();
      expect(
        screen.getByText(`${weekday(-2)}'s session didn't happen. We moved its most important step into today, so today stays the same length.`),
      ).toBeVisible();
    });

    it('dropped yesterday, and dropped on an earlier weekday; the reason is never shown', async () => {
      reconciled({ notice: 'dropped', dropped: [{ date: isoDay(-1), taskId: 't2', reason: 'high_load' }] });
      await renderToday();
      expect(screen.getByText("Yesterday's session didn't happen. Nothing needs making up: the plan carries on as it is.")).toBeVisible();
      expect(screen.queryByText(/high.load/i)).not.toBeInTheDocument();
      expectCalmCopy();
    });

    it('dropped on an earlier weekday', async () => {
      reconciled({ notice: 'dropped', dropped: [{ date: isoDay(-2), taskId: 't1', reason: 'does_not_fit' }] });
      await renderToday();
      expect(screen.getByText(`${weekday(-2)}'s session didn't happen. Nothing needs making up: the plan carries on as it is.`)).toBeVisible();
    });

    it('shows one line only, even when several days were carried or dropped', async () => {
      reconciled({
        notice: 'carried',
        carried: [carriedFrom(-1, 0), carriedFrom(-2, 1)],
        dropped: [{ date: isoDay(-1), taskId: 't2', reason: 'high_load' }],
      });
      await renderToday();
      expect(lines()).toHaveLength(1);
      expect(screen.getByText(/^Yesterday's session didn't happen\. We moved its most important step into today/)).toBeVisible();
    });

    it.each([
      ['gentle_return', { notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: isoDay(-4), lastDate: isoDay(-1) } }],
      ['null', { notice: null, carried: [carriedFrom(-1, 0)] }],
    ] as Array<[string, Partial<MissedSignals>]>)('shows nothing for %s', async (_, signals) => {
      reconciled(signals);
      await renderToday();
      expect(lines()).toHaveLength(0);
    });

    it('shows nothing when reconcile fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mocked.reconcileGoal.mockRejectedValue(new Error('Failed to reconcile goal'));
      await renderToday();
      expect(lines()).toHaveLength(0);
      warn.mockRestore();
    });

    it('shows nothing on a rest day', async () => {
      reconciled({ notice: 'dropped', dropped: [{ date: isoDay(-1), taskId: 't2', reason: 'high_load' }] });
      mocked.fetchActiveGoal.mockResolvedValueOnce({
        ...GOAL,
        dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, isRestDay: true } : t)),
      } as unknown as Goal);
      await renderToday();
      expect(screen.getByText("Today's rest")).toBeInTheDocument();
      expect(lines()).toHaveLength(0);
      // B-72: a rest day shows no minutes.
      // (The "Tomorrow" preview of the next practice day keeps its minutes.)
      expect(screen.getByRole('region', { name: tasks[2].title }).textContent?.split('Tomorrow')[0]).not.toMatch(/\d+ min/);
    });

    it('belongs to today only, not to another selected day', async () => {
      const user = userEvent.setup();
      reconciled({ notice: 'carried', carried: [carriedFrom(-1, 0)] });
      await renderToday();
      expect(lines()).toHaveLength(1);
      const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
      await user.click(days.find((b) => b.getAttribute('aria-label')?.startsWith('Thu'))!);
      expect(screen.getByText("Thursday's step")).toBeInTheDocument();
      expect(lines()).toHaveLength(0);
    });
  });

  describe('short on time and gentle return (missed sessions M3.2)', () => {
    const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
    const reconciled = (signals: Partial<MissedSignals>) =>
      mocked.reconcileGoal.mockResolvedValue({
        applies: true,
        goalId: 'g1',
        asOf: new Date().toISOString(),
        timezone: 'UTC',
        days: [],
        gap: null,
        carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
        signals: { ...NONE, ...signals },
      });
    const GENTLE: Partial<MissedSignals> = { notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: isoDay(-4), lastDate: isoDay(-1) } };
    const WELCOME = "Welcome back. Today's a short one to ease in.";
    const COUNTS = 'The 10-minute version still counts toward this week.';
    /** Today (t3) with a 10-minute version, plus any changes to it. */
    const withMinimum = (today: Partial<DailyTask> = {}) =>
      mocked.fetchActiveGoal.mockResolvedValueOnce({
        ...GOAL,
        dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, minimumVersion: MINIMUM, ...today } : t)),
      } as unknown as Goal);
    const button = (name: string) => screen.queryByRole('button', { name });
    const expectUnchanged = () => {
      expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
      expect(screen.queryByText(COUNTS)).not.toBeInTheDocument();
      expect(button('Start the 10-minute version')).not.toBeInTheDocument();
      expect(button('Start the full session')).not.toBeInTheDocument();
    };
    const expectCalmCopy = () => {
      const text = document.body.textContent ?? '';
      for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
    };

    it('gentle-return day: a deadline that passed during the gap is named (logic check, B-39)', async () => {
      reconciled(GENTLE);
      const due = JSON.stringify([{ stepNumber: 1, title: 'Send the application', durationMinutes: 30, instructions: 'Send it.', focusCue: '', priority: 1, dueDate: isoDay(-1) }]);
      mocked.fetchActiveGoal.mockResolvedValueOnce({
        ...GOAL,
        dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, minimumVersion: MINIMUM } : t.id === 't2' ? { ...t, status: 'pending', detailedSteps: due } : t)),
      } as unknown as Goal);
      await renderToday();
      expect(await screen.findByText(`${WELCOME} The deadline for "Send the application" passed while you were away.`)).toBeVisible();
    });

    it("gentle-return day: the card shows the 10-minute version's minutes (B-1)", async () => {
      reconciled(GENTLE);
      withMinimum();
      await renderToday();
      expect(await screen.findByText(WELCOME)).toBeVisible();
      const card = screen.getByRole('region', { name: tasks[2].title });
      expect(within(card).getByText(/^10 min · 2 steps · at 19:30$/)).toBeInTheDocument();
      expect(within(card).queryByText(/^30 min/)).not.toBeInTheDocument();
    });

    it('gentle-return day: the welcome line, the 10-minute version as the gold action, the full session one tap away', async () => {
      reconciled(GENTLE);
      withMinimum();
      await renderToday();
      expect(screen.getByText(WELCOME)).toBeVisible();
      const primary = screen.getByRole('button', { name: 'Start the 10-minute version' });
      const full = screen.getByRole('button', { name: 'Start the full session' });
      expect(button('Start')).not.toBeInTheDocument();
      // Primary first, then the full session, in reading and keyboard order.
      expect(primary.compareDocumentPosition(full) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByText(COUNTS)).not.toBeInTheDocument();
      expectCalmCopy();
    });

    it('gentle-return day: the gold action opens Focus mode on the 10-minute version and records it', async () => {
      const user = userEvent.setup();
      reconciled(GENTLE);
      withMinimum();
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Start the 10-minute version' }));
      await user.click(screen.getByRole('button', { name: /start focused session/i }));
      expect(screen.getByText('Minimum version')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /complete minimum/i }));
      await user.click(screen.getByRole('button', { name: /finish & return/i }));
      expect(mocked.updateDailyTask).toHaveBeenCalledWith('t3', { status: 'completed', notes: undefined, usedMinimumVersion: true }, 't');
    });

    it('gentle-return day: "Start the full session" opens the full session, as Start does', async () => {
      const user = userEvent.setup();
      reconciled(GENTLE);
      withMinimum();
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Start the full session' }));
      await user.click(screen.getByRole('button', { name: /start focused session/i }));
      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
      expect(screen.queryByText('Minimum version')).not.toBeInTheDocument();
    });

    it('short on time: Start stays first, the 10-minute version is one tap away, with its line under the buttons', async () => {
      const user = userEvent.setup();
      reconciled({ shortOnTime: true });
      withMinimum();
      await renderToday();
      const start = screen.getByRole('button', { name: 'Start' });
      const minimum = screen.getByRole('button', { name: 'Start the 10-minute version' });
      expect(start.compareDocumentPosition(minimum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const line = screen.getByText(COUNTS);
      expect(line).toBeVisible();
      expect(minimum.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
      expectCalmCopy();

      await user.click(minimum);
      await user.click(screen.getByRole('button', { name: /start focused session/i }));
      expect(screen.getByText('Minimum version')).toBeInTheDocument();
    });

    it('short on time together with a carried line: both show, the carried line as the notice', async () => {
      reconciled({
        shortOnTime: true,
        notice: 'carried',
        carried: [{ fromDate: isoDay(-1), fromTaskId: 't2', toDate: isoDay(0), toTaskId: 't3', stepTitle: 'Lead' }],
      });
      withMinimum();
      await renderToday();
      expect(screen.getByText(/^Yesterday's session didn't happen\. We moved its most important step into today/)).toBeVisible();
      expect(screen.getByText(COUNTS)).toBeVisible();
      expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Start the 10-minute version' })).toBeVisible();
    });

    it('both signals: only the gentle-return day shows', async () => {
      reconciled({ ...GENTLE, shortOnTime: true });
      withMinimum();
      await renderToday();
      expect(screen.getByText(WELCOME)).toBeVisible();
      expect(screen.queryByText(COUNTS)).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Start the 10-minute version' })).toHaveLength(1);
    });

    it('neither signal: Today is unchanged', async () => {
      reconciled({});
      withMinimum();
      await renderToday();
      expectUnchanged();
      expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    });

    it.each([
      ['gentle return', GENTLE],
      ['short on time', { shortOnTime: true }],
    ] as Array<[string, Partial<MissedSignals>]>)('%s without a 10-minute version: nothing changes, nothing says short', async (_, signals) => {
      reconciled(signals);
      await renderToday();
      expectUnchanged();
      expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
    });

    it.each([
      ['gentle return', GENTLE],
      ['short on time', { shortOnTime: true }],
    ] as Array<[string, Partial<MissedSignals>]>)('%s on a completed day: nothing changes', async (_, signals) => {
      reconciled(signals);
      withMinimum({ status: 'completed' });
      await renderToday();
      expectUnchanged();
    });

    it.each([
      ['gentle return', GENTLE],
      ['short on time', { shortOnTime: true }],
    ] as Array<[string, Partial<MissedSignals>]>)('%s belongs to today only, not to another selected day', async (_, signals) => {
      const user = userEvent.setup();
      reconciled(signals);
      mocked.fetchActiveGoal.mockResolvedValueOnce({
        ...GOAL,
        dailyTasks: tasks.map((t) => (t.isRestDay ? t : { ...t, minimumVersion: MINIMUM })),
      } as unknown as Goal);
      await renderToday();
      expect(button('Start the 10-minute version')).toBeInTheDocument();
      const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
      await user.click(days.find((b) => b.getAttribute('aria-label')?.startsWith('Tue'))!);
      expect(screen.getByText("Tuesday's step")).toBeInTheDocument();
      expectUnchanged();
      // Tuesday is done: ND-30 offers it again quietly, never the 10-minute version.
      expect(screen.getByRole('button', { name: 'Do it again' })).toBeVisible();
    });
  });

  it('renders restyled BasisBadge in header / metadata when goal.basis.label is present', async () => {
    const goalWithBasis = {
      ...GOAL,
      basis: { label: 'Ultralearning', anchored: true },
    } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithBasis);
    await renderToday();
    expect(screen.getByText('Ultralearning')).toBeVisible();
  });

  it('renders closing stretch state when at day 90 / after week 12 with no remaining tasks (M9.4-R1)', async () => {
    const goalComplete = {
      ...GOAL,
      currentWeek: 12,
      targetDate: isoDay(-5),
      dailyTasks: [],
    } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalComplete);
    await renderToday();

    expect(screen.getByText('DAYS 85–90 · THE CLOSING STRETCH')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Look back and arrive' })).toBeVisible();
    expect(
      screen.getByText(/The 84 planned practice days are complete/i)
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review 90-day staircase' })).toHaveAttribute('href', '/roadmap');
    expect(
      screen.getByRole('button', { name: 'Complete my journey' })
    ).toBeVisible();
  });

  it('renders offline notice banner when apiStatus is offline', async () => {
    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter>
            <Today goal={GOAL} apiStatus="offline" />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    expect(
      await screen.findByText('Achivii is offline. You can view your plan, but changes cannot be saved until you reconnect.')
    ).toBeVisible();
  });

  it('surfaces visible accessible error alert when task completion write fails', async () => {
    const user = userEvent.setup();
    mocked.updateDailyTask.mockRejectedValueOnce(new Error('Network error'));
    await renderToday();

    const markBtn = screen.getByRole('button', { name: 'Mark complete' });
    await user.click(markBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("That didn't save. Please check your connection and try again.");
    // Failed write did not leave step in fake completed state
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeVisible();
    expect(screen.queryByText('Session 3 is in the books.')).not.toBeInTheDocument();
  });

  it('the weekly review is gone: no review card or button, even once the week is over (weeks close on their own)', async () => {
    const pastTasks = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 10) }));
    mocked.fetchActiveGoal.mockResolvedValueOnce({ ...GOAL, dailyTasks: pastTasks } as unknown as Goal);
    await renderToday();
    expect(screen.queryByText('Review due')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review/i })).not.toBeInTheDocument();
  });
});

describe('Today: swap offer, set today aside, swap with another day (missed sessions M3.3)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const CARRY = { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] };
  const body = (signals: Partial<MissedSignals> = {}, extra: Partial<Reconciliation> = {}): Reconciliation =>
    ({ applies: true, goalId: 'g1', asOf: '', timezone: 'UTC', days: [], gap: null, carry: CARRY, signals: { ...NONE, ...signals }, ...extra }) as Reconciliation;
  const weekday = (offset: number) =>
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${isoDay(offset)}T00:00:00Z`).getUTCDay()];
  const offer = (missedTaskId: string, missedOffset: number, receivingTaskId: string, receivingOffset: number): Partial<MissedSignals> => ({
    notice: 'swap_offer',
    swapOffer: { missedTaskId, missedDate: isoDay(missedOffset), receivingTaskId, receivingDate: isoDay(receivingOffset), offerUntil: '' },
  });
  /** The goal with changes to some days (t1, t2 done; t3 today; t4-t6 later; t7 rest). */
  const goalWith = (changes: Record<string, Partial<DailyTask>> = {}) =>
    ({ ...GOAL, dailyTasks: tasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) }) as unknown as Goal;
  const marked = (marker: Record<string, unknown>) => JSON.stringify([{ ...JSON.parse(STEPS)[0], ...marker }, JSON.parse(STEPS)[1]]);
  const button = (name: string) => screen.queryByRole('button', { name });
  const NEW = ['Swap the days', 'Just move its main step', 'Set today aside', 'Swap with another day'];
  const expectCalm = () => {
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
  };
  const SERVER_TEXT = 'This day has already been changed.';

  it('with the switch off nothing new appears, even with a swap offer', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t2: { status: 'pending', isKeySession: true } }));
    mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0), { carry: { ...CARRY, enabled: false } }));
    await renderToday();
    for (const name of NEW) expect(button(name)).not.toBeInTheDocument();
    expect(screen.queryByText(/key session didn't happen/)).not.toBeInTheDocument();
  });

  describe('swap offer', () => {
    beforeEach(() => {
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t2: { status: 'pending', isKeySession: true } }));
    });

    // ND-25: a past day's key session is swapped onto its receiving day without asking.
    const REFUSED = () => new api.ApiError('This swap would put two hard sessions too close together.', 409, 'rest_gap');

    it('a day before today is swapped onto today without asking, and says so', async () => {
      mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockResolvedValue(body());
      await renderToday();
      expect(
        await screen.findByText("Yesterday's key session didn't happen, so we moved it to today. It takes the place of the session planned for today."),
      ).toBeVisible();
      expect(mocked.swapDays).toHaveBeenCalledTimes(1);
      expect(mocked.swapDays).toHaveBeenCalledWith('t2', 't3', { t2: STEPS, t3: STEPS }, 't');
      expect(button('Swap the days')).not.toBeInTheDocument();
      expect(button('Just move its main step')).not.toBeInTheDocument();
      expectCalm();
    });

    it('an earlier weekday is named', async () => {
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'pending', isKeySession: true } }));
      mocked.reconcileGoal.mockResolvedValue(body(offer('t1', -2, 't3', 0)));
      mocked.swapDays.mockResolvedValue(body());
      await renderToday();
      expect(await screen.findByText(new RegExp(`^${weekday(-2)}'s key session didn't happen, so we moved it to today\\.`))).toBeVisible();
    });

    it('a session set aside today is the person\'s own choice, so it still asks', async () => {
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t3: { isKeySession: true } }));
      mocked.reconcileGoal.mockResolvedValue(body(offer('t3', 0, 't4', 1)));
      await renderToday();
      expect(await screen.findByText(`Today's key session is set aside. Do it ${weekday(1)} instead?`)).toBeVisible();
      expect(button('Swap the days')).toBeVisible();
      expect(mocked.swapDays).not.toHaveBeenCalled();
    });

    it('when the swap is refused, the question shows as before, with no error the person did not cause', async () => {
      mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockRejectedValueOnce(REFUSED());
      await renderToday();
      expect(await screen.findByText("Yesterday's key session didn't happen. Do it today instead?")).toBeVisible();
      expect(button('Swap the days')).toBeVisible();
      expect(button('Just move its main step')).toBeVisible();
      expect(screen.queryByText("That didn't change. Please try again.")).not.toBeInTheDocument();
      expect(mocked.swapDays).toHaveBeenCalledTimes(1);
    });

    it('after a refused swap, "Just move its main step" carries now and shows the carried line', async () => {
      const user = userEvent.setup();
      mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockRejectedValueOnce(REFUSED());
      mocked.carryNow.mockResolvedValue(
        body({ notice: 'carried', carried: [{ fromDate: isoDay(-1), fromTaskId: 't2', toDate: isoDay(0), toTaskId: 't3', stepTitle: 'Warm up' }] }),
      );
      await renderToday();
      await user.click(await screen.findByRole('button', { name: 'Just move its main step' }));
      expect(mocked.carryNow).toHaveBeenCalledWith('t2', 't');
      expect(
        await screen.findByText("Yesterday's session didn't happen. We moved its most important step into today, so today stays the same length."),
      ).toBeVisible();
      expect(button('Swap the days')).not.toBeInTheDocument();
    });

    it('a refusal of a tap says "That didn\'t change. Please try again." beside the answers, never the server text', async () => {
      const user = userEvent.setup();
      mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockRejectedValueOnce(REFUSED());
      mocked.carryNow.mockRejectedValue(new api.ApiError(SERVER_TEXT, 409, 'already_handled'));
      await renderToday();
      await user.click(await screen.findByRole('button', { name: 'Just move its main step' }));
      expect(await screen.findByText("That didn't change. Please try again.")).toBeVisible();
      expect(screen.queryByText(SERVER_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByText(/already_handled/)).not.toBeInTheDocument();
      expect(screen.getByText("Yesterday's key session didn't happen. Do it today instead?")).toBeVisible();
      expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(1);
    });

    it('a 409 changed on the automatic swap reloads the plan and shows it as it is now', async () => {
      mocked.reconcileGoal.mockResolvedValueOnce(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockRejectedValue(new api.ApiError('The plan changed since it was loaded.', 409, 'changed'));
      mocked.reconcileGoal.mockResolvedValue(body());
      await renderToday();
      await waitFor(() => expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2));
      expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
      expect(mocked.swapDays).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/since it was loaded/)).not.toBeInTheDocument();
      expect(button('Swap the days')).not.toBeInTheDocument();
    });

    it('belongs to Today\'s view of today only', async () => {
      const user = userEvent.setup();
      mocked.reconcileGoal.mockResolvedValue(body(offer('t2', -1, 't3', 0)));
      mocked.swapDays.mockRejectedValueOnce(REFUSED());
      await renderToday();
      await screen.findByRole('button', { name: 'Swap the days' });
      await user.click(screen.getByRole('button', { name: /^Thu / }));
      for (const name of NEW) expect(button(name)).not.toBeInTheDocument();
      expect(screen.queryByText(/key session didn't happen/)).not.toBeInTheDocument();
    });
  });

  describe('set today aside', () => {
    beforeEach(() => {
      mocked.reconcileGoal.mockResolvedValue(body());
    });

    it('opens a dialog; "Keep today" closes it, changes nothing, and returns focus', async () => {
      const user = userEvent.setup();
      await renderToday();
      const trigger = screen.getByRole('button', { name: 'Set today aside' });
      await user.click(trigger);
      const dialog = screen.getByRole('dialog', { name: "Set today's session aside?" });
      expect(within(dialog).getByText('Nothing gets longer.')).toBeVisible();
      expect(within(dialog).getByRole('button', { name: 'Set it aside' })).toBeVisible();
      await user.click(within(dialog).getByRole('button', { name: 'Keep today' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mocked.markTodayMissed).not.toHaveBeenCalled();
      await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('Escape closes the dialog', async () => {
      const user = userEvent.setup();
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mocked.markTodayMissed).not.toHaveBeenCalled();
    });

    it('carried: "Today\'s session is set aside. We moved its most important step to {Weekday}…"', async () => {
      const user = userEvent.setup();
      mocked.markTodayMissed.mockResolvedValue(
        body({ notice: 'carried', carried: [{ fromDate: isoDay(0), fromTaskId: 't3', toDate: isoDay(1), toTaskId: 't4', stepTitle: 'Warm up' }] }),
      );
      await renderToday();
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t4: { detailedSteps: marked({ carriedFrom: { taskId: 't3', date: isoDay(0), replaced: [] } }) } }));
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.click(screen.getByRole('button', { name: 'Set it aside' }));
      expect(mocked.markTodayMissed).toHaveBeenCalledWith('t3', 't');
      expect(
        await screen.findByText(`Today's session is set aside. We moved its most important step to ${weekday(1)}, so that day stays the same length.`),
      ).toBeVisible();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      // Today is now the source of a move: neither action again.
      expect(button('Set today aside')).not.toBeInTheDocument();
      expect(button('Swap with another day')).not.toBeInTheDocument();
      expectCalm();
    });

    it('dropped (from the response\'s carry.drops): "Today\'s session is set aside. Nothing needs making up…"', async () => {
      const user = userEvent.setup();
      mocked.markTodayMissed.mockResolvedValue(
        body({}, {
          days: [{ taskId: 't3', date: isoDay(0), weekNumber: 1, dayNumber: 3, isKeySession: false, isTestDay: false, kind: 'missed' }],
          carry: { ...CARRY, drops: [{ taskId: 't3', date: isoDay(0), reason: 'high_load' }] },
        }),
      );
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.click(screen.getByRole('button', { name: 'Set it aside' }));
      expect(await screen.findByText("Today's session is set aside. Nothing needs making up: the plan carries on as it is.")).toBeVisible();
      expect(button('Set today aside')).not.toBeInTheDocument();
      expectCalm();
    });

    it('held (a key session): the swap offer for today, kept from the response', async () => {
      const user = userEvent.setup();
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t3: { isKeySession: true } }));
      mocked.markTodayMissed.mockResolvedValue(
        body(offer('t3', 0, 't4', 1), {
          days: [{ taskId: 't3', date: isoDay(0), weekNumber: 1, dayNumber: 3, isKeySession: true, isTestDay: false, kind: 'missed' }],
        }),
      );
      mocked.swapDays.mockResolvedValue(body());
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.click(screen.getByRole('button', { name: 'Set it aside' }));
      expect(await screen.findByText(`Today's key session is set aside. Do it ${weekday(1)} instead?`)).toBeVisible();
      expect(button('Set today aside')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Swap the days' }));
      expect(mocked.swapDays).toHaveBeenCalledWith('t3', 't4', { t3: STEPS, t4: STEPS }, 't');
    });

    it('a refusal or a network failure says so in the dialog, which stays open; never the server text', async () => {
      const user = userEvent.setup();
      mocked.markTodayMissed.mockRejectedValueOnce(new api.ApiError(SERVER_TEXT, 409, 'already_handled'));
      mocked.markTodayMissed.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await user.click(screen.getByRole('button', { name: 'Set it aside' }));
        const dialog = screen.getByRole('dialog');
        expect(await within(dialog).findByText("That didn't change. Please try again.")).toBeVisible();
      }
      expect(screen.queryByText(SERVER_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
      expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(1);
    });

    it('a double click sends once', async () => {
      const user = userEvent.setup();
      mocked.markTodayMissed.mockReturnValue(new Promise(() => {}));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.dblClick(screen.getByRole('button', { name: 'Set it aside' }));
      expect(mocked.markTodayMissed).toHaveBeenCalledTimes(1);
    });
  });

  describe('swap with another day', () => {
    beforeEach(() => {
      mocked.reconcileGoal.mockResolvedValue(body());
    });

    it('lists the open practice days later this week that are not the test day and no move has touched', async () => {
      const user = userEvent.setup();
      mocked.fetchActiveGoal.mockResolvedValue(
        // t2 is open (missed): a carry from a done day would be ignored (B-52).
        goalWith({
          t2: { status: 'pending' },
          t4: { title: 'Hill repeats' },
          t5: { isTestDay: true },
          t6: { detailedSteps: marked({ carriedFrom: { taskId: 't2', date: isoDay(-1), replaced: [] } }) },
        }),
      );
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      const dialog = screen.getByRole('dialog', { name: 'Swap with another day' });
      const choices = within(dialog).getAllByRole('listitem').map((item) => item.textContent);
      expect(choices).toEqual([`${weekday(1)}: Hill repeats`]);
    });

    it('choosing a day swaps it with today, applies the answer and closes the dialog', async () => {
      const user = userEvent.setup();
      const t5Steps = JSON.stringify([{ stepNumber: 1, title: 'Strides', durationMinutes: 30, instructions: '', focusCue: '' }]);
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t5: { title: 'Strides', detailedSteps: t5Steps } }));
      mocked.swapDays.mockResolvedValue(body());
      await renderToday();
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t3: { title: 'Strides', detailedSteps: t5Steps }, t5: { title: 'Easy base run' } }));
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      await user.click(screen.getByRole('button', { name: `${weekday(2)}: Strides` }));
      expect(mocked.swapDays).toHaveBeenCalledWith('t3', 't5', { t3: STEPS, t5: t5Steps }, 't');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(await screen.findByRole('region', { name: 'Strides' })).toBeInTheDocument();
    });

    it('with no eligible day: "No other day this week can be swapped." and "Close"', async () => {
      const user = userEvent.setup();
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t4: { status: 'completed' }, t5: { isTestDay: true }, t6: { status: 'completed' } }));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      const dialog = screen.getByRole('dialog', { name: 'Swap with another day' });
      expect(within(dialog).getByText('No other day this week can be swapped.')).toBeVisible();
      await user.click(within(dialog).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mocked.swapDays).not.toHaveBeenCalled();
    });

    it('a 409 changed closes the dialog, reloads, and says so', async () => {
      const user = userEvent.setup();
      mocked.swapDays.mockRejectedValue(new api.ApiError('The plan changed since it was loaded.', 409, 'changed'));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      await user.click(screen.getByRole('button', { name: `${weekday(1)}: Session 4` }));
      expect(await screen.findByText("Your plan changed. Here's the latest.")).toBeVisible();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
      expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
    });

    it('not on the test day; set aside is still there', async () => {
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t3: { isTestDay: true } }));
      await renderToday();
      expect(button('Swap with another day')).not.toBeInTheDocument();
      expect(button('Set today aside')).toBeVisible();
    });

    it('today holding a carried step cannot be swapped', async () => {
      mocked.fetchActiveGoal.mockResolvedValue(
        goalWith({ t2: { status: 'pending' }, t3: { detailedSteps: marked({ carriedFrom: { taskId: 't2', date: isoDay(-1), replaced: [] } }) } }),
      );
      await renderToday();
      expect(button('Swap with another day')).not.toBeInTheDocument();
      expect(button('Set today aside')).toBeVisible();
    });
  });

  it.each([
    ['a rest day', { t3: { isRestDay: true } }],
    ['a completed day', { t3: { status: 'completed' as const } }],
  ])('nothing on %s', async (_, changes) => {
    mocked.fetchActiveGoal.mockResolvedValue(goalWith(changes as Record<string, Partial<DailyTask>>));
    mocked.reconcileGoal.mockResolvedValue(body());
    await renderToday();
    for (const name of NEW) expect(button(name)).not.toBeInTheDocument();
  });

  it('nothing on another selected day', async () => {
    const user = userEvent.setup();
    mocked.reconcileGoal.mockResolvedValue(body());
    await renderToday();
    expect(button('Set today aside')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^Thu / }));
    for (const name of NEW) expect(button(name)).not.toBeInTheDocument();
  });
});

describe('Today with method-aware recovery (M3.3)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null, line: null };
  const CHOICES = { today: { taskId: 't3', setAside: true, swapWith: ['t4'] }, held: [] };
  const CARRY = { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [], outcomes: [], choices: CHOICES };
  const body = (signals: Partial<MissedSignals> = {}, carry: Record<string, unknown> = {}): Reconciliation =>
    ({ applies: true, goalId: 'g1', asOf: '', timezone: 'UTC', days: [], gap: null, carry: { ...CARRY, ...carry }, signals: { ...NONE, ...signals } }) as Reconciliation;
  const weekday = (offset: number) =>
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${isoDay(offset)}T00:00:00Z`).getUTCDay()];
  /** The server's line for the day `from` days from today, naming the day `to` days from today. */
  const line = (kind: string, from: number, to: number | null): Partial<MissedSignals> => ({
    notice: kind === 'carried' || kind === 'dropped' ? (kind as 'carried' | 'dropped') : 'method',
    line: { kind: kind as never, taskId: 'x', date: isoDay(from), toTaskId: to === null ? null : 'y', toDate: to === null ? null : isoDay(to) },
  });
  const goalWith = (changes: Record<string, Partial<DailyTask>> = {}) =>
    ({ ...GOAL, dailyTasks: tasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) }) as unknown as Goal;
  const button = (name: string) => screen.queryByRole('button', { name });
  const expectCalm = () => {
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i, /skipped/i]) expect(text).not.toMatch(word);
  };

  // Section 6's second sentences, word for word; `to` is the receiving day (0 is today) or null.
  const OUTCOMES: Array<[string, number | null, () => string]> = [
    ['moved', 1, () => `We moved its most important step to ${weekday(1)}, so that day stays the same length.`],
    ['moved', 0, () => 'We moved its most important step into today, so today stays the same length.'],
    ['moved_in_order', 1, () => `We moved it to ${weekday(1)}, and the next ones follow on.`],
    ['moved_in_order', 0, () => 'We moved it into today, and the next ones follow on.'],
    ['continued', 1, () => `${weekday(1)}'s session picks up where you left off.`],
    ['continued', 0, () => "Today's session picks up where you left off."],
    // B-38, B-39.
    ['restarted', 1, () => `${weekday(1)}'s session starts the process again from its first step.`],
    ['restarted', 0, () => "Today's session starts the process again from its first step."],
    ['due_passed', null, () => 'Its deadline has passed, so nothing moves and the plan carries on.'],
    ['let_go', null, () => 'Nothing needs making up: the plan carries on as it is.'],
    ['fixed', null, () => 'It was set for that day, so the plan carries on as it is.'],
    ['no_room', null, () => "There's no room for it this week without making a day longer, so next week's plan takes it into account."],
    ['next_week', null, () => "There's no room for it this week, so next week starts with it."],
    ['left_out', null, () => "This was the plan's last week, so it's left out."],
  ];

  describe('the miss line, exact words (section 6, AC-7)', () => {
    it.each(OUTCOMES)('%s (to %s): yesterday and an earlier weekday', async (kind, to, rest) => {
      mocked.reconcileGoal.mockResolvedValue(body(line(kind, -1, to)));
      const { unmount } = render(
        <AuthProvider>
          <GoalProvider>
            <MemoryRouter>
              <Harness />
            </MemoryRouter>
          </GoalProvider>
        </AuthProvider>,
      );
      expect(await screen.findByText(`Yesterday's session didn't happen. ${rest()}`)).toBeVisible();
      expect(screen.queryAllByText(/session didn't happen/)).toHaveLength(1);
      expectCalm();
      unmount();
      mocked.reconcileGoal.mockResolvedValue(body(line(kind, -2, to)));
      await renderToday();
      expect(await screen.findByText(`${weekday(-2)}'s session didn't happen. ${rest()}`)).toBeVisible();
    });

    it.each(OUTCOMES.filter(([, to]) => to !== 0))('%s (to %s): set aside today', async (kind, to, rest) => {
      mocked.reconcileGoal.mockResolvedValue(body(line(kind, 0, to)));
      await renderToday();
      expect(await screen.findByText(`Today's session is set aside. ${rest()}`)).toBeVisible();
      expectCalm();
    });

    it("a day under missed sessions' rules keeps its lines", async () => {
      mocked.reconcileGoal.mockResolvedValue(body(line('dropped', -1, null)));
      await renderToday();
      expect(await screen.findByText("Yesterday's session didn't happen. Nothing needs making up: the plan carries on as it is.")).toBeVisible();
    });

    it('set aside with nothing stored: the line comes from the action\'s answer; a reload without it shows none', async () => {
      const user = userEvent.setup();
      mocked.reconcileGoal.mockResolvedValue(body());
      mocked.markTodayMissed.mockResolvedValue(body(line('fixed', 0, null)));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Set today aside' }));
      await user.click(screen.getByRole('button', { name: 'Set it aside' }));
      expect(await screen.findByText("Today's session is set aside. It was set for that day, so the plan carries on as it is.")).toBeVisible();
    });

    it('no line when the server sends none, and none with the carry switch off for a day set aside', async () => {
      mocked.reconcileGoal.mockResolvedValue(body({ notice: 'method', line: null }));
      const { unmount } = render(
        <AuthProvider>
          <GoalProvider>
            <MemoryRouter>
              <Harness />
            </MemoryRouter>
          </GoalProvider>
        </AuthProvider>,
      );
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText(/didn't happen|set aside\./)).not.toBeInTheDocument();
      unmount();
      mocked.reconcileGoal.mockResolvedValue(body(line('let_go', 0, null), { enabled: false, choices: { today: null, held: [] } }));
      await renderToday();
      expect(screen.queryByText(/set aside\./)).not.toBeInTheDocument();
    });
  });

  describe("choices from the server's carry.choices (RULE-16, AC-8)", () => {
    it('set aside only when allowed; swap only when the server names a day', async () => {
      mocked.reconcileGoal.mockResolvedValue(body({}, { choices: { today: { taskId: 't3', setAside: true, swapWith: [] }, held: [] } }));
      const { unmount } = render(
        <AuthProvider>
          <GoalProvider>
            <MemoryRouter>
              <Harness />
            </MemoryRouter>
          </GoalProvider>
        </AuthProvider>,
      );
      await screen.findByRole('heading', { level: 1 });
      expect(button('Set today aside')).toBeVisible();
      expect(button('Swap with another day')).not.toBeInTheDocument();
      unmount();
      mocked.reconcileGoal.mockResolvedValue(body({}, { choices: { today: { taskId: 't3', setAside: false, swapWith: [] }, held: [] } }));
      await renderToday();
      expect(button('Set today aside')).not.toBeInTheDocument();
      expect(button('Swap with another day')).not.toBeInTheDocument();
    });

    it('the swap list offers exactly the server\'s days', async () => {
      const user = userEvent.setup();
      // t4 and t6 are open practice days the browser would offer; the server allows only t6.
      mocked.reconcileGoal.mockResolvedValue(body({}, { choices: { today: { taskId: 't3', setAside: true, swapWith: ['t6'] }, held: [] } }));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      const dialog = screen.getByRole('dialog', { name: 'Swap with another day' });
      expect(within(dialog).getAllByRole('listitem').map((item) => item.textContent)).toEqual([`${weekday(3)}: Session 6`]);
    });

    it('nothing when the server offers nothing for today', async () => {
      mocked.reconcileGoal.mockResolvedValue(body({}, { choices: { today: null, held: [] } }));
      await renderToday();
      expect(button('Set today aside')).not.toBeInTheDocument();
      expect(button('Swap with another day')).not.toBeInTheDocument();
    });

    it('"Just move its main step" only when the held day\'s step would move', async () => {
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t2: { status: 'pending', isKeySession: true } }));
      const offer = { notice: 'swap_offer' as const, swapOffer: { missedTaskId: 't2', missedDate: isoDay(-1), receivingTaskId: 't3', receivingDate: isoDay(0), offerUntil: '' } };
      mocked.reconcileGoal.mockResolvedValue(body(offer, { choices: { today: null, held: [{ taskId: 't2', receivingTaskId: 't3', moveNowTaskId: null }] } }));
      const { unmount } = render(
        <AuthProvider>
          <GoalProvider>
            <MemoryRouter>
              <Harness />
            </MemoryRouter>
          </GoalProvider>
        </AuthProvider>,
      );
      expect(await screen.findByText("Yesterday's key session didn't happen. Do it today instead?")).toBeVisible();
      expect(button('Swap the days')).toBeVisible();
      expect(button('Just move its main step')).not.toBeInTheDocument();
      unmount();
      mocked.reconcileGoal.mockResolvedValue(body(offer, { choices: { today: null, held: [{ taskId: 't2', receivingTaskId: 't3', moveNowTaskId: 't4' }] } }));
      await renderToday();
      expect(await screen.findByRole('button', { name: 'Just move its main step' })).toBeVisible();
    });

    it.each(['fixed_step', 'out_of_order', 'rest_gap', 'holds_carry', 'holds_continue', 'would_not_move'])('a %s refusal is a quiet failure', async (code) => {
      const user = userEvent.setup();
      mocked.reconcileGoal.mockResolvedValue(body());
      mocked.swapDays.mockRejectedValue(new api.ApiError('Server words.', 409, code));
      await renderToday();
      await user.click(screen.getByRole('button', { name: 'Swap with another day' }));
      await user.click(screen.getByRole('button', { name: `${weekday(1)}: Session 4` }));
      expect(await screen.findByText("That didn't change. Please try again.")).toBeVisible();
      expect(screen.queryByText('Server words.')).not.toBeInTheDocument();
      expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(1);
    });
  });

  describe('step instructions (RULE-10, RULE-21, MR-26)', () => {
    const EASY = 'First hard session after a few days off: keep the effort easy today.';
    const WARM = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

    it('the continue line and the stored first lines each show on their own line; the rest as stored', async () => {
      const user = userEvent.setup();
      const steps = JSON.stringify([
        { stepNumber: 1, title: 'Draft chapter', durationMinutes: 20, instructions: `${EASY}\n${WARM}\nWrite the next scene.`, focusCue: '', continueFrom: { taskId: 't1', date: isoDay(-2) } },
        { stepNumber: 2, title: 'Notes', durationMinutes: 10, instructions: 'List three ideas.', focusCue: '' },
      ]);
      const minimumVersion = { stepNumber: 1, title: 'Short version: Draft chapter', durationMinutes: 10, instructions: `${EASY}\nWrite one paragraph.`, focusCue: '', pitfallToAvoid: '' };
      // The continued day is open (missed), so its continue line shows (B-50).
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'pending' }, t3: { detailedSteps: steps, minimumVersion } }));
      mocked.reconcileGoal.mockResolvedValue(body());
      await renderToday();
      await openAllSteps();
      const first = screen.getByText('Draft chapter').closest('li')!;
      const lines = [`Pick up where ${weekday(-2)} stopped.`, EASY, WARM, 'Write the next scene.'];
      for (const text of lines) expect(within(first).getByText(text).tagName).toBe('P');
      expect(within(first).queryByText(new RegExp(`stopped\\. ${EASY}`))).not.toBeInTheDocument();
      expect(screen.getByText('List three ideas.')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'The 10-minute version' }));
      expect(screen.getByText('Write one paragraph.').tagName).toBe('P');
      expect(screen.getAllByText(EASY)).toHaveLength(2);
    });

    it('B-50: no continue line on Today or in Focus when the day it names is done; shown while that day is open', async () => {
      const user = userEvent.setup();
      const steps = JSON.stringify([
        { stepNumber: 1, title: 'Draft chapter', durationMinutes: 20, instructions: 'Write the next scene.', focusCue: '', continueFrom: { taskId: 't1', date: isoDay(-2) } },
      ]);
      const pickUp = `Pick up where ${weekday(-2)} stopped.`;
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'completed' }, t3: { detailedSteps: steps } }));
      mocked.reconcileGoal.mockResolvedValue(body());
      await renderToday();
      await openAllSteps();
      expect(screen.getByText('Write the next scene.')).toBeVisible();
      expect(screen.queryByText(pickUp)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Start' }));
      expect(screen.queryByText(pickUp)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /start focused session/i }));
      expect(within(screen.getByRole('article', { name: 'Current step' })).queryByText(pickUp)).not.toBeInTheDocument();
      cleanup();

      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'pending' }, t3: { detailedSteps: steps } }));
      await renderToday();
      await openAllSteps();
      expect(screen.getByText(pickUp)).toBeVisible();
    });

    it('B-52: a moved step from a done day is hidden on Today and in Focus; the day reads from the next step', async () => {
      const user = userEvent.setup();
      const steps = JSON.stringify([
        { stepNumber: 1, title: 'Tempo run', durationMinutes: 20, instructions: `${WARM}\nRun at tempo.`, focusCue: '', priority: 1, carriedFrom: { taskId: 't1', date: isoDay(-2), replaced: [] } },
        { stepNumber: 2, title: 'Strides', durationMinutes: 8, instructions: 'Six easy strides.', focusCue: '', priority: 2 },
        { stepNumber: 3, title: 'Stretch', durationMinutes: 2, instructions: 'Stretch calves.', focusCue: '', priority: 3 },
      ]);
      const stored = {
        title: 'Tempo run',
        detailedSteps: steps,
        implementationIntention: 'At 19:30: Tempo run.',
        minimumVersion: { stepNumber: 1, title: 'Short version: Tempo run', durationMinutes: 10, instructions: 'Ten minutes at tempo.', focusCue: '', pitfallToAvoid: '' },
      };
      // The source day was set aside (Tempo run moved on) and then done anyway: it still holds Tempo run (B-55).
      const holds = { status: 'completed' as const, detailedSteps: JSON.stringify([{ stepNumber: 1, title: 'Tempo run', durationMinutes: 20, instructions: 'Run at tempo.', focusCue: '', priority: 1 }]) };
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: holds, t3: stored }));
      mocked.reconcileGoal.mockResolvedValue(body());
      await renderToday();
      expect(screen.getByRole('heading', { level: 2, name: 'Strides' })).toBeInTheDocument();
      expect(screen.getByText('10 min · 2 steps · at 19:30')).toBeInTheDocument();
      await openAllSteps();
      expect(screen.queryByText('Run at tempo.')).not.toBeInTheDocument();
      expect(screen.getAllByText('Six easy strides.')[0]).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'The 10-minute version · When and where' }));
      expect(screen.getByText('Short version: Strides')).toBeVisible();
      expect(screen.queryByText('Ten minutes at tempo.')).not.toBeInTheDocument();
      expect(screen.getByText('At 19:30: Strides.')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Start' }));
      expect(within(screen.getByRole('dialog')).getByRole('heading', { level: 2, name: 'Strides' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /start focused session/i }));
      expect(screen.getByText('10:00')).toBeInTheDocument();
      cleanup();

      // The source day still open: the day as stored, the moved step shown.
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'pending' }, t3: stored }));
      await renderToday();
      expect(screen.getByRole('heading', { level: 2, name: 'Tempo run' })).toBeInTheDocument();
      expect(screen.getByText('30 min · 3 steps · at 19:30')).toBeInTheDocument();
      await openAllSteps();
      expect(screen.getByText('Run at tempo.')).toBeVisible();
      cleanup();

      // B-55: the source day is done but gave Tempo run up (it no longer holds it): the step was never done, so it shows.
      mocked.fetchActiveGoal.mockResolvedValue(goalWith({ t1: { status: 'completed', detailedSteps: '[]' }, t3: stored }));
      await renderToday();
      expect(screen.getByRole('heading', { level: 2, name: 'Tempo run' })).toBeInTheDocument();
      expect(screen.getByText('30 min · 3 steps · at 19:30')).toBeInTheDocument();
    });
  });
});

// Weekly update M1.4 (RULE-14, AC-11, WU-13, WU-33): after a move, "Day N" leaves the moved days out, and a day not
// offered is shown like a rest day: never "not done", never counted as a practice day.
describe('Today after a move (weekly update M1.4)', () => {
  // Week 3 (plan days 15 to 21), today is its third day (day 17); Mon and Tue were not offered.
  const moved = tasks.map((t, index) => ({ ...t, weekNumber: 3, dayNumber: 15 + index, status: 'pending' as const, notOffered: index < 2 }));
  const MOVED_GOAL = { ...GOAL, currentWeek: 3, targetDate: `${isoDay(91 - 17)}T00:00:00.000Z`, roadmapWeeks: [{ weekNumber: 3, phase: 'Aerobic base', theme: 'Easy miles' }], dailyTasks: moved } as unknown as Goal;

  it('Day N follows the moved end date', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(MOVED_GOAL);
    await renderToday();
    expect(screen.getByLabelText('Day 17 of 90')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Easy base run' })).toBeInTheDocument();
  });

  it('days not offered read as rest days in the week and are not counted as practice days', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(MOVED_GOAL);
    await renderToday();
    const days = screen.getAllByRole('button', { hidden: true, name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d/ });
    expect(days[0]).toHaveAccessibleName(expect.stringMatching(/, rest day$/));
    expect(days[1]).toHaveAccessibleName(expect.stringMatching(/, rest day$/));
    expect(days[2]).toHaveAccessibleName(expect.stringMatching(/, today, to do$/));
    // B-71: a day still ahead reads as upcoming.
    expect(days[3]).toHaveAccessibleName(expect.stringMatching(/, upcoming$/));
    // Six practice days less the two not offered.
    expect(screen.getByText('0 of 4 practice days done')).toBeInTheDocument();
  });

  // The review's change 2: tapping a day not offered opens what a rest day opens, never a step with a done action (its
  // in-order steps were queued onto later days). Change 1: one holding the queue's toNextWeek records reads the same.
  it('tapping a day not offered (even one holding toNextWeek records) opens the rest-day view', async () => {
    const records = JSON.stringify([
      { stepNumber: 1, title: 'Lesson 100', durationMinutes: 20, instructions: 'Do it.', priority: 1, kind: 'lesson', toNextWeek: [{ taskId: 't1', date: isoDay(-2), step: { title: 'Lesson 104', kind: 'lesson' } }] },
    ]);
    mocked.fetchActiveGoal.mockResolvedValue({ ...MOVED_GOAL, dailyTasks: moved.map((t, i) => (i === 0 ? { ...t, title: 'Lesson 100', detailedSteps: records } : t)) } as unknown as Goal);
    await renderToday();
    const days = screen.getAllByRole('button', { hidden: true, name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d\d/ });
    expect(days[0]).toHaveAccessibleName(expect.stringMatching(/, rest day$/));
    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith('Mon'))!);
    // B-73: the rest view names no practice.
    const card = screen.getByRole('region', { name: 'No practice planned' });
    expect(within(card).getByText("Monday's rest")).toBeInTheDocument();
    // Review fix 1: nothing to complete on a day not offered.
    expect(within(card).queryByRole('button', { name: 'Log your rest' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Mark not done' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
    expect(within(card).queryByText('Do it.')).not.toBeInTheDocument();
  });

  // Review fix 1: a day not offered that was marked complete (before the fix) never hides the step the queue moved from
  // it, and shows no practice text or completion button.
  it('a completed day not offered does not hide its moved step; its rest view has no practice text', async () => {
    const lesson = { stepNumber: 1, title: 'Lesson 100', durationMinutes: 20, instructions: 'Do lesson 100.', priority: 1, kind: 'lesson' };
    const days = moved.map((t, i) =>
      i === 0
        ? { ...t, status: 'completed' as const, title: 'Lesson 100', detailedSteps: JSON.stringify([lesson]), whyToday: 'Why Monday matters', implementationIntention: 'When: 7am | Where: desk | Action: lesson' }
        : i === 2
          ? { ...t, detailedSteps: JSON.stringify([{ ...lesson, shiftedFrom: { taskId: t.id.replace(/\d+$/, '1'), date: moved[0].date, replaced: [] } }, { stepNumber: 2, title: 'Review notes', durationMinutes: 10, instructions: 'Read them.', priority: 2, kind: 'notes' }]) }
          : t,
    );
    mocked.fetchActiveGoal.mockResolvedValue({ ...MOVED_GOAL, dailyTasks: days } as unknown as Goal);
    await renderToday();
    // Today (Wednesday) still shows the lesson moved from Monday.
    expect(within(screen.getByRole('region', { name: 'Easy base run' })).getByText('Lesson 100')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith('Mon'))!);
    // B-73: the rest view names no practice.
    const card = screen.getByRole('region', { name: 'No practice planned' });
    expect(within(card).getByText("Monday's rest")).toBeInTheDocument();
    expect(within(card).queryByText('Why Monday matters')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Implementation intention/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Mark not done|Log recovery complete|Mark complete/ })).not.toBeInTheDocument();
    expect(within(card).queryByText('Rest logged')).not.toBeInTheDocument();
  });
});

describe('Today: the Dashboard\'s Start link (ND-29)', () => {
  const renderStarting = async () => {
    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter initialEntries={[{ pathname: '/', state: { startSession: true } }]}>
            <Harness />
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>,
    );
    return screen.findByRole('heading', { level: 1 });
  };

  it("opens today's session at once", async () => {
    await renderStarting();
    expect(await screen.findByRole('button', { name: /start focused session/i })).toBeVisible();
  });

  it('opens nothing when today is already done', async () => {
    mocked.fetchActiveGoal.mockResolvedValue({ ...GOAL, dailyTasks: tasks.map((t) => (t.id === 't3' ? { ...t, status: 'completed' as const } : t)) });
    await renderStarting();
    await screen.findByRole('region', { name: 'Easy base run' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Today: the done moment and another day (ND-30)', () => {
  it('a done session says its number, offers it again quietly, and Focus counts it before it is saved', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: /start focused session/i }));
    await user.click(screen.getByRole('button', { name: /done — next/i }));
    await user.click(screen.getByRole('button', { name: /complete session/i }));
    expect(screen.getByText('Session complete · Session 3')).toBeInTheDocument();
    expect(screen.getByText('3 of 6 this week.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /finish & return/i }));
    expect(await screen.findByText('Session 3 is in the books.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Do it again' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('another day has a way back to today', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith('Thu'))!);
    expect(screen.getByText("Thursday's step")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to today' }));
    expect(screen.getByText("Today's step")).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Back to today' })).not.toBeInTheDocument();
  });
});
