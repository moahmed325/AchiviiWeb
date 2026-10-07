import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { useGoal } from '../context/GoalContext';
import { todayKey } from '../lib/today';
import type { DailyTask, Goal, MissedSignals, Reconciliation } from '../types';

vi.mock('../context/GoalContext', () => ({ useGoal: vi.fn() }));
vi.mock('../hooks/useJourneyData', () => ({ useJourneyData: () => null }));

const DAY_MS = 24 * 60 * 60 * 1000;

const step = (n: number, title: string, minutes: number) => ({
  stepNumber: n, title, durationMinutes: minutes, instructions: '', focusCue: '', pitfallToAvoid: '',
});

const makeTask = (overrides: Partial<DailyTask>): DailyTask => ({
  id: 't', goalId: 'g', weekNumber: 4, dayNumber: 1, date: todayKey(new Date()), dayOfWeek: 'Monday', title: 'Task',
  detailedSteps: '[]', implementationIntention: '', durationMinutes: 30, isRestDay: false, status: 'pending',
  created_at: '2026-09-01T00:00:00.000Z', ...overrides,
});

const buildGoal = (todayStatus: 'pending' | 'completed'): Goal => {
  const now = Date.now();
  const tasks: DailyTask[] = [
    makeTask({ id: 't1', dayNumber: 1, dayOfWeek: 'Monday', title: 'Easy base run', status: 'completed', date: todayKey(new Date(now - DAY_MS)) }),
    makeTask({
      id: 't2', dayNumber: 2, dayOfWeek: 'Tuesday', title: 'Tempo intervals', status: todayStatus, isKeySession: true, slotTime: '07:00',
      detailedSteps: JSON.stringify([step(1, 'Warm up jog', 10), step(2, 'Four tempo reps', 20), step(3, 'Cool down walk', 5), step(4, 'Log the session', 2)]),
      whyToday: 'Builds the pace you will race at.',
    }),
    makeTask({ id: 't3', dayNumber: 3, dayOfWeek: 'Wednesday', title: 'Long steady run', date: todayKey(new Date(now + DAY_MS)) }),
  ];
  return {
    id: 'g', userId: 'u', rawGoal: 'Run a 10K', clarifiedOutcome: 'Run 10 kilometers in under 50 minutes', methodologyNotes: '',
    status: 'active', startDate: '2026-09-01T00:00:00.000Z', targetDate: `${todayKey(new Date(now + 63 * DAY_MS))}T00:00:00.000Z`, currentWeek: 4,
    answers: '{}', routine: '{}', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    roadmapWeeks: [{ id: 'rw', goalId: 'g', weekNumber: 4, phase: 'Aerobic Foundation', theme: 'Building Volume', objective: 'x', keyMilestone: 'First 5km continuous run', targetIntensity: 65, plannedMinutes: 140, status: 'active', created_at: '2026-09-01' }],
    dailyTasks: tasks,
  } as unknown as Goal;
};

const renderWith = (goal: Goal, reconciliation: Reconciliation | null = null) => {
  vi.mocked(useGoal).mockReturnValue({ activeGoal: goal, loadingGoal: false, goalLoadFailed: false, refreshGoal: vi.fn(), reconciliation } as unknown as ReturnType<typeof useGoal>);
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
};

describe('Dashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the day ring, a status sentence from real state, and what is inside the session', () => {
    renderWith(buildGoal('pending'));

    expect(screen.getByRole('img', { name: 'Day 28 of 90' })).toBeInTheDocument();
    expect(screen.getByText('62 days to go')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 sessions done this week. Keep the rhythm.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Tempo intervals' })).toBeInTheDocument();
    expect(screen.getByText('Key session')).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Inside this session' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText('Warm up jog')).toBeInTheDocument();
    expect(screen.getByText('+ 1 more step')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Begin today/i })).toHaveAttribute('href', '/');
  });

  it('shows what is coming up without inventing anything', () => {
    renderWith(buildGoal('pending'));

    const strip = screen.getByRole('region', { name: 'Coming up' });
    expect(within(strip).getByText('Later this week')).toBeInTheDocument();
    expect(within(strip).getByText(/Wednesday/)).toBeInTheDocument();
    expect(within(strip).getByText('First 5km continuous run')).toBeInTheDocument();
  });

  it('celebrates a finished day and hides the step preview', () => {
    renderWith(buildGoal('completed'));

    expect(screen.getByText('Well done. Today is complete.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review today/i })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Inside this session' })).not.toBeInTheDocument();
  });

  describe('status line from the reconcile signals (missed sessions M3.1, ND-19)', () => {
    const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
    const weekday = (offset: number) => new Date(`${key(offset)}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
    const body = (signals: Partial<MissedSignals>) => ({ applies: true, goalId: 'g', signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
    const carried = (from: number, to: number) => ({ fromDate: key(from), fromTaskId: 'x', toDate: key(to), toTaskId: 'y', stepTitle: 'Lead' });
    const UNCHANGED = '1 of 3 sessions done this week. Keep the rhythm.';
    const calm = () => {
      const text = document.body.textContent ?? '';
      for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
    };

    it('carried into today, from yesterday or an earlier weekday', () => {
      const { unmount } = renderWith(buildGoal('pending'), body({ notice: 'carried', carried: [carried(-1, 0)] }));
      expect(screen.getByText("Yesterday's most important step is part of today's session.")).toBeInTheDocument();
      calm();
      unmount();
      renderWith(buildGoal('pending'), body({ notice: 'carried', carried: [carried(-2, 0)] }));
      expect(screen.getByText(`${weekday(-2)}'s most important step is part of today's session.`)).toBeInTheDocument();
    });

    it('dropped, yesterday or an earlier weekday', () => {
      const { unmount } = renderWith(buildGoal('pending'), body({ notice: 'dropped', dropped: [{ date: key(-1), taskId: 't1', reason: 'high_load' }] }));
      expect(screen.getByText('Yesterday slipped past. No catching up needed, just today.')).toBeInTheDocument();
      calm();
      unmount();
      renderWith(buildGoal('pending'), body({ notice: 'dropped', dropped: [{ date: key(-2), taskId: 't0', reason: 'does_not_fit' }] }));
      expect(screen.getByText(`${weekday(-2)} slipped past. No catching up needed, just today.`)).toBeInTheDocument();
    });

    it('a step carried to a later day, other notices, and no reconcile leave the line unchanged', () => {
      const cases: Array<Reconciliation | null> = [
        body({ notice: 'carried', carried: [carried(-1, 1)] }),
        body({ notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: key(-4), lastDate: key(-1) } }),
        body({ notice: 'swap_offer', swapOffer: { missedTaskId: 't1', missedDate: key(-1), receivingTaskId: 't2', receivingDate: key(0), offerUntil: '' } }),
        body({ notice: null }),
        null,
      ];
      for (const reconciliation of cases) {
        const { unmount } = renderWith(buildGoal('pending'), reconciliation);
        expect(screen.getByText(UNCHANGED)).toBeInTheDocument();
        unmount();
      }
    });

    it('yesterday left pending no longer drives a line by itself', () => {
      const goal = buildGoal('pending');
      goal.dailyTasks = goal.dailyTasks!.map((t) => (t.id === 't1' ? { ...t, status: 'pending' as const } : t));
      renderWith(goal, null);
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
      expect(screen.getByText('A fresh week. One session at a time.')).toBeInTheDocument();
    });

    it('keeps the old priority: a finished day and a rest day speak first', () => {
      const dropped = body({ notice: 'dropped', dropped: [{ date: key(-1), taskId: 't1', reason: 'high_load' }] });
      const { unmount } = renderWith(buildGoal('completed'), dropped);
      expect(screen.getByText('1 session left this week. Rest well tonight.')).toBeInTheDocument();
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
      unmount();
      const rest = buildGoal('pending');
      rest.dailyTasks = rest.dailyTasks!.map((t) => (t.id === 't2' ? { ...t, isRestDay: true } : t));
      renderWith(rest, dropped);
      expect(screen.getByText('A rest day is part of the plan. Let the work settle in.')).toBeInTheDocument();
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
    });
  });
});

describe('Dashboard: gentle-return line (missed sessions M3.2, ND-19)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const body = (signals: Partial<MissedSignals>) => ({ applies: true, goalId: 'g', signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
  const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
  const GENTLE: Partial<MissedSignals> = { notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: key(-4), lastDate: key(-1) } };
  const MINIMUM = { stepNumber: 1, title: 'Ten minutes', durationMinutes: 10, instructions: '', focusCue: '', pitfallToAvoid: '' };
  const withMinimum = (status: 'pending' | 'completed' = 'pending') => {
    const goal = buildGoal(status);
    goal.dailyTasks = goal.dailyTasks!.map((t) => (t.id === 't2' ? { ...t, minimumVersion: MINIMUM } : t));
    return goal;
  };
  const WELCOME = "Welcome back. Today's a short one to ease in.";

  beforeEach(() => vi.clearAllMocks());

  it('says the welcome line on a gentle-return day, and nothing about being short on time', () => {
    renderWith(withMinimum(), body({ ...GENTLE, shortOnTime: true }));
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    expect(screen.queryByText(/still counts toward this week/)).not.toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
  });

  it('has no short-on-time line', () => {
    renderWith(withMinimum(), body({ shortOnTime: true }));
    expect(screen.queryByText(/10-minute version/)).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 sessions done this week. Keep the rhythm.')).toBeInTheDocument();
  });

  it('keeps the old priority: a finished day speaks first', () => {
    renderWith(withMinimum('completed'), body(GENTLE));
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
  });
});
