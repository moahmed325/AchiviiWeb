import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal } from '../../types';
import { Today } from './Today';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    updateDailyTask: vi.fn(),
    submitWeeklyReview: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const DAY = 86_400_000;
const isoDay = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
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
  targetDate: new Date(Date.now() + 88 * DAY).toISOString(),
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
    expect(screen.getByText('Day 3 of 90 • Focus Mode')).toBeInTheDocument();
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

  it('renders reassuring non-punitive recovery card when yesterday task was uncompleted', async () => {
    // Yesterday (t2) is pending
    const tasksWithYesterdayPending = tasks.map((t) => (t.id === 't2' ? { ...t, status: 'pending' as const } : t));
    const goalWithPendingYesterday = { ...GOAL, dailyTasks: tasksWithYesterdayPending } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalWithPendingYesterday);
    await renderToday();

    // Reassuring recovery card is displayed
    expect(screen.getByText("Yesterday's step wasn't completed")).toBeVisible();
    expect(
      screen.getByText(
        "Here's how we can recover. Don't try to double up or rush. Focus entirely on today's step and keep your momentum forward."
      )
    ).toBeVisible();

    // Strictly NO punitive copy
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/behind/i)).not.toBeInTheDocument();
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

  it('renders 90-day journey complete state when at day 90 / after week 12 with no remaining tasks', async () => {
    const goalComplete = {
      ...GOAL,
      currentWeek: 12,
      targetDate: isoDay(-5),
      dailyTasks: [],
    } as unknown as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(goalComplete);
    await renderToday();

    expect(screen.getByText('90-Day Journey')).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: '90-Day Journey Complete' })).toBeVisible();
    expect(
      screen.getByText('You have completed the 90-day deliberate practice path for this goal.')
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review 90-day roadmap' })).toHaveAttribute('href', '/roadmap');
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
});


