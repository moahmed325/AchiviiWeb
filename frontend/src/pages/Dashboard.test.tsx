import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { useGoal } from '../context/GoalContext';
import { todayKey } from '../lib/today';
import type { DailyTask, Goal } from '../types';

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
    status: 'active', startDate: '2026-09-01T00:00:00.000Z', targetDate: new Date(now + 63 * DAY_MS).toISOString(), currentWeek: 4,
    answers: '{}', routine: '{}', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    roadmapWeeks: [{ id: 'rw', goalId: 'g', weekNumber: 4, phase: 'Aerobic Foundation', theme: 'Building Volume', objective: 'x', keyMilestone: 'First 5km continuous run', targetIntensity: 65, plannedMinutes: 140, status: 'active', created_at: '2026-09-01' }],
    dailyTasks: tasks,
  } as unknown as Goal;
};

const renderWith = (goal: Goal) => {
  vi.mocked(useGoal).mockReturnValue({ activeGoal: goal, loadingGoal: false, goalLoadFailed: false, refreshGoal: vi.fn() } as unknown as ReturnType<typeof useGoal>);
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
    expect(screen.getByRole('link', { name: /Begin today/i })).toHaveAttribute('href', '/today');
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
});
