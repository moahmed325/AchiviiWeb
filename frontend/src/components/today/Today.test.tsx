import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal, MissedSignals } from '../../types';
import { Today } from './Today';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn().mockResolvedValue({ applies: false, reason: 'no_active_goal' }),
    updateDailyTask: vi.fn(),
    submitWeeklyReview: vi.fn(),
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

describe('Today', () => {
  it('heads with the goal the user chose, the stored outcome beneath it as stored, then Day N / 90', async () => {
    const heading = await renderToday();
    expect(heading).toHaveTextContent('Run a 10K Under 50 Minutes');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('49.98')).toBeInTheDocument();
    expect(screen.getByText('49.98').closest('p')).toHaveTextContent('90-day outcome: 49.98');
    expect(screen.getByLabelText('Day 3 of 90')).toHaveTextContent('3/ 90');
    expect(
      screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === 'Week 1 · Aerobic base · Easy miles'),
    ).toBeInTheDocument();
  });

  it("shows today's step, its duration and slot, and the week as practice days", async () => {
    await renderToday();
    const step = screen.getByRole('region', { name: 'Easy base run' });
    expect(within(step).getByText("Today's step")).toBeInTheDocument();
    expect(within(step).getByText('30 min · at 19:30')).toBeInTheDocument();
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
    expect(screen.getByText('Minimum complete')).toBeInTheDocument();
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

  it('the steps reveal shows each instruction and focus cue', async () => {
    await renderToday();
    const reveal = screen.getByRole('button', { name: 'Show the 2 steps' });
    expect(reveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Jog gently for ten minutes.')).not.toBeVisible();
    await userEvent.click(reveal);
    expect(screen.getByRole('button', { name: 'Hide the steps' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Jog gently for ten minutes.')).toBeVisible();
    expect(screen.getByText('Nose breathing.')).toBeVisible();
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

  it("choosing another day shows that day's step", async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Show week' }));
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

    // 2. Step fields hidden initially behind "Show the 2 steps"
    const stepsReveal = screen.getByRole('button', { name: 'Show the 2 steps' });
    expect(stepsReveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Complete 10 min without stopping.')).not.toBeVisible();

    await userEvent.click(stepsReveal);
    expect(screen.getByRole('button', { name: 'Hide the steps' })).toHaveAttribute('aria-expanded', 'true');
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

    // 3. The 10-minute version is closed by default, not forced, and shows stored copy on open
    const minimumReveal = screen.getByRole('button', { name: 'The 10-minute version' });
    expect(minimumReveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('10-minute shakeout')).not.toBeVisible();
    await userEvent.click(minimumReveal);
    expect(screen.getByRole('button', { name: 'Hide the 10-minute version' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('10-minute shakeout')).toBeVisible();
    expect(screen.getByText('10 minutes easy jog around the block.')).toBeVisible();
    expect(screen.getByText('Finish continuous 10 min.')).toBeVisible();
    // Only one Start button on screen (from the main step, not inside the 10-minute version)
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(1);

    // 4. Implementation intention
    const intentionReveal = screen.getByRole('button', { name: 'Implementation intention' });
    expect(intentionReveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('7:00 AM')).not.toBeVisible();
    await userEvent.click(intentionReveal);
    expect(screen.getByText('7:00 AM')).toBeVisible();
    expect(screen.getByText('Park trail')).toBeVisible();
    expect(screen.getByText('Run steadily')).toBeVisible();

    // 5. Task-level resource
    const resourceReveal = screen.getByRole('button', { name: 'Resource' });
    expect(resourceReveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Pacing Strategy')).not.toBeVisible();
    await userEvent.click(resourceReveal);
    const taskLink = screen.getByRole('link', { name: /Pacing Strategy/ });
    expect(taskLink).toHaveAttribute('href', 'https://example.com/pacing');
    expect(screen.getByText('guide')).toBeVisible();
    expect(screen.getByText('Helps prevent late fade')).toBeVisible();
  });

  it('omits extra reveals when optional session fields are absent (M5.3 layout preserved)', async () => {
    // Default GOAL tasks have empty whyToday, implementationIntention, minimumVersion, resourceTitle
    await renderToday();
    expect(screen.queryByRole('button', { name: /10-minute version/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Implementation intention/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resource$/i })).not.toBeInTheDocument();
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

    const intentionReveal = screen.getByRole('button', { name: 'Implementation intention' });
    await userEvent.click(intentionReveal);
    expect(screen.getByText('Just put on running shoes and head out right away.')).toBeVisible();
    expect(screen.queryByText('When')).not.toBeInTheDocument();
  });

  it('displays onward navigation to Roadmap and retires the full day view link (OD-3)', async () => {
    await renderToday();
    expect(screen.getByRole('link', { name: 'Roadmap' })).toHaveAttribute('href', '/roadmap');
    expect(screen.queryByRole('link', { name: 'Open full day view' })).not.toBeInTheDocument();
    expect(screen.queryByText(/The full day view shows/i)).not.toBeInTheDocument();
  });

  it('lights up completed step with quiet confirmation, shows next step preview, and reverts cleanly', async () => {
    const user = userEvent.setup();
    await renderToday();

    // Initially pending: no completion confirmation, no next step preview
    expect(screen.queryByText('Step completed. Deliberate practice logged for today.')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow · Thursday')).not.toBeInTheDocument();

    // Mark complete
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));

    // 1. Completed step lighting & quiet confirmation
    expect(screen.getByText('Step completed. Deliberate practice logged for today.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeVisible();

    // 2. Next step preview card appears
    expect(screen.getByText('Tomorrow · Thursday')).toBeVisible();
    expect(screen.getByText('Session 4')).toBeVisible();

    // 3. Click "View Thursday's step" navigates to Thursday
    await user.click(screen.getByRole('button', { name: "View Thursday's step" }));
    expect(screen.getByRole('region', { name: 'Session 4' })).toBeInTheDocument();

    // Switch back to Wednesday
    await user.click(screen.getByRole('button', { name: 'Show week' }));
    const wedBtn = screen.getAllByRole('button', { pressed: false }).find((b) => b.getAttribute('aria-label')?.startsWith('Wed'))!;
    await user.click(wedBtn);

    // Revert completion
    await user.click(screen.getByRole('button', { name: 'Mark not done' }));
    expect(screen.queryByText('Step completed. Deliberate practice logged for today.')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow · Thursday')).not.toBeInTheDocument();
  });

  it('displays week completion bridge when the final practice task of the week is completed', async () => {
    const user = userEvent.setup();
    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Show week' }));

    // Select Saturday (last practice day of the week, task t6)
    const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
    const saturday = days.find((b) => b.getAttribute('aria-label')?.startsWith('Sat'))!;
    await user.click(saturday);
    expect(screen.getByRole('region', { name: 'Session 6' })).toBeInTheDocument();

    // Mark Saturday complete
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));

    // Bridge appears pointing to week review
    expect(screen.getByText('Week 1 practice complete.')).toBeVisible();
    expect(screen.getByText('Weekly review ready.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start weekly review' })).toBeVisible();
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
    await renderToday();

    // Select Sunday (rest day)
    await user.click(screen.getByRole('button', { name: 'Show week' }));
    const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
    const sunday = days.find((b) => b.getAttribute('aria-label')?.startsWith('Sun'))!;
    await user.click(sunday);

    // Eyebrow and badge
    expect(screen.getByText("Sunday's rest")).toBeVisible();
    expect(screen.getByText('Rest day')).toBeVisible();

    // Intentional adaptation explanation
    expect(
      screen.getByText('Rest is where adaptation happens. Take today to recover so you can execute your next session at full intensity.')
    ).toBeVisible();

    // Start (focus mode) button is suppressed on rest days
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();

    // Recovery action button
    const recoveryBtn = screen.getByRole('button', { name: 'Log recovery complete' });
    expect(recoveryBtn).toBeVisible();

    // Toggle recovery complete
    await user.click(recoveryBtn);
    expect(screen.getByText('Rest logged. Deliberate recovery recorded for today.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark not done' })).toBeVisible();
  });

  it('renders key session state with accent badge and pivotal session callout', async () => {
    const keyTask: DailyTask = { ...tasks[2], isKeySession: true };
    const goalWithKey = { ...GOAL, dailyTasks: tasks.map((t) => (t.id === 't3' ? keyTask : t)) } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithKey);
    await renderToday();

    expect(screen.getByText('Key session')).toBeVisible();
    expect(
      screen.getByText('This is your pivotal session for Week 1. Focus on execution quality and adherence.')
    ).toBeVisible();
    // Start button still available
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  it('renders test day benchmark card with instructions and pass mark without fake score inputs', async () => {
    const testTask: DailyTask = { ...tasks[2], isTestDay: true };
    const goalWithTest = {
      ...GOAL,
      roadmapWeeks: [
        {
          weekNumber: 1,
          phase: 'Aerobic base',
          theme: 'Easy miles',
          test: {
            type: '5K',
            instructions: 'Run 5K at maximum sustainable effort on a flat course.',
            passIf: 'finish in under 25:00',
          },
        },
      ],
      dailyTasks: tasks.map((t) => (t.id === 't3' ? testTask : t)),
    } as unknown as Goal;

    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithTest);
    await renderToday();

    expect(screen.getByText('Test day')).toBeVisible();
    expect(screen.getByText('5K Benchmark')).toBeVisible();
    expect(screen.getByText('Run 5K at maximum sustainable effort on a flat course.')).toBeVisible();
    expect(screen.getByText('Pass mark:')).toBeVisible();
    expect(screen.getByText('Pass if finish in under 25:00.')).toBeVisible();

    // Honesty rule (OD-1a): No score inputs, sliders, or pass/fail submit forms
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/score/i)).not.toBeInTheDocument();
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
      ['swap_offer', { notice: 'swap_offer', swapOffer: { missedTaskId: 't2', missedDate: isoDay(-1), receivingTaskId: 't3', receivingDate: isoDay(0), offerUntil: '' } }],
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
    });

    it('belongs to today only, not to another selected day', async () => {
      const user = userEvent.setup();
      reconciled({ notice: 'carried', carried: [carriedFrom(-1, 0)] });
      await renderToday();
      expect(lines()).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Show week' }));
      const days = screen.getAllByRole('button', { pressed: false }).filter((b) => b.getAttribute('aria-label')?.includes(','));
      await user.click(days.find((b) => b.getAttribute('aria-label')?.startsWith('Thu'))!);
      expect(screen.getByText("Thursday's step")).toBeInTheDocument();
      expect(lines()).toHaveLength(0);
    });
  });

  it('renders review due banner when all tasks of the week have passed', async () => {
    // All tasks in the week occurred in the past (e.g. days -10 to -4)
    const pastTasks = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 10) }));
    const goalWithPastTasks = { ...GOAL, dailyTasks: pastTasks } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithPastTasks);
    await renderToday();

    expect(screen.getByRole('heading', { level: 2, name: 'Week 1 is ready for review' })).toBeVisible();
    expect(screen.getByText('Review due')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Start weekly review' })).toBeVisible();
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

  it('opens weekly review modal from review due button and submits reflection', async () => {
    const user = userEvent.setup();
    const pastTasks = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 10) }));
    const goalWithPastTasks = { ...GOAL, dailyTasks: pastTasks } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithPastTasks);
    mocked.submitWeeklyReview.mockResolvedValueOnce({
      review: {
        id: 'rev-1',
        goalId: 'g1',
        weekNumber: 1,
        tasksPlanned: 6,
        tasksCompleted: 6,
        scorePercentage: 100,
        reflection: '',
        aiAdaptationInsight: '',
        created_at: '',
      },
      scorePercentage: 100,
      nextWeekNumber: 2,
      nextWeekTasks: [],
    });

    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Start weekly review' }));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Week 1 Review' })).toBeVisible();

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Great consistency all week');

    await user.click(screen.getByRole('button', { name: 'Start Week 2' }));
    expect(mocked.submitWeeklyReview).toHaveBeenCalledWith(1, 'Great consistency all week', 't');
  });

  it('handles 503 error on weekly review submission gracefully and allows retry', async () => {
    const user = userEvent.setup();
    const pastTasks = tasks.map((t, idx) => ({ ...t, date: isoDay(idx - 10) }));
    const goalWithPastTasks = { ...GOAL, dailyTasks: pastTasks } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithPastTasks);
    mocked.submitWeeklyReview.mockRejectedValueOnce(
      new Error("Couldn't write next week right now. This week is unchanged; please try again.")
    );

    await renderToday();
    await user.click(screen.getByRole('button', { name: 'Start weekly review' }));

    const textarea = screen.getByPlaceholderText(/Morning sessions went well/i);
    await user.type(textarea, 'Tough week but pushed through');

    await user.click(screen.getByRole('button', { name: 'Start Week 2' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't write next week right now. This week is unchanged; please try again."
    );
    // Reflection is kept intact
    expect(textarea).toHaveValue('Tough week but pushed through');
    // Button offers retry
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
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
    expect(screen.getByRole('heading', { level: 2, name: 'The Final Evaluation & Arrival' })).toBeVisible();
    expect(
      screen.getByText(/The 84 planned deliberate practice days are complete/i)
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review 90-day staircase' })).toHaveAttribute('href', '/roadmap');
    expect(
      screen.getByRole('button', { name: 'Complete Journey & Arrive at the Garden' })
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
    expect(screen.queryByText('Step completed. Deliberate practice logged for today.')).not.toBeInTheDocument();
  });

  it('renders review due card when all active practice tasks are completed ahead of time (M7.4-R3)', async () => {
    // Current tasks where all active practice sessions are completed
    const completedTasks = tasks.map((t) =>
      t.isRestDay ? t : { ...t, status: 'completed' as const }
    );
    const goalWithCompletedTasks = { ...GOAL, dailyTasks: completedTasks } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithCompletedTasks);
    await renderToday();

    expect(screen.getByRole('heading', { level: 2, name: 'Week 1 is ready for review' })).toBeVisible();
    expect(screen.getByText('Review due')).toBeVisible();
  });

  it('renders closing stretch unlock messaging on Week 12 review due card (M7.4-R3)', async () => {
    const pastTasks = tasks.map((t, idx) => ({ ...t, weekNumber: 12, date: isoDay(idx - 10) }));
    const week12Goal = {
      ...GOAL,
      currentWeek: 12,
      dailyTasks: pastTasks,
      roadmapWeeks: [{ weekNumber: 12, status: 'active', phase: 'Closing' }],
    } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(week12Goal);
    await renderToday();

    expect(screen.getByRole('heading', { level: 2, name: 'Week 12 is ready for review' })).toBeVisible();
    expect(
      screen.getByText("You've reached the end of Week 12. Complete this review to unlock your final closing stretch (days 85–90).")
    ).toBeVisible();
  });

  it('allows opening weekly review prior to review due from WeekGlance and footer nav (M7.4-R5)', async () => {
    const user = userEvent.setup();
    // Default GOAL has pending practice tasks in the future so reviewDue is false
    await renderToday();

    // Review due banner is not displayed
    expect(screen.queryByText('Review due')).not.toBeInTheDocument();

    // But everyday review entry point is available in WeekGlance
    const glanceReviewBtn = screen.getByRole('button', { name: 'Review week' });
    expect(glanceReviewBtn).toBeVisible();
    await user.click(glanceReviewBtn);

    // Modal opens
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Week 1 Review' })).toBeVisible();

    // Close modal
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Footer nav entry point is also available
    const navReviewBtn = screen.getByRole('button', { name: 'Weekly review' });
    expect(navReviewBtn).toBeVisible();
    await user.click(navReviewBtn);

    expect(screen.getByRole('dialog')).toBeVisible();
  });
});



