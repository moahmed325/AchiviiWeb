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
  return { ...actual, fetchHealthCheck: vi.fn(), fetchCurrentUser: vi.fn(), fetchActiveGoal: vi.fn(), updateDailyTask: vi.fn() };
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
    expect(await screen.findByText("That didn't save. Try again.")).toBeInTheDocument();
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

  it('displays updated onward copy naming only what remains exclusively on /dashboard', async () => {
    await renderToday();
    const onwardText = screen.getByText('The full day view shows the week review, plan panel and routine visualiser when your plan has them.');
    expect(onwardText).toBeInTheDocument();
    expect(screen.queryByText(/why today matters/i)).not.toBeInTheDocument();
  });
});

