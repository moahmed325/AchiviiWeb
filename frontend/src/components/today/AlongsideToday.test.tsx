import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DailyTask, Goal } from '../../types';
import { completeGoal, updateDailyTask } from '../../lib/api';
import { AlongsideToday } from './AlongsideToday';

const ctx = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 't', user: { timezone: 'UTC' } }) }));
vi.mock('../../lib/api', () => ({ updateDailyTask: vi.fn(), completeGoal: vi.fn().mockResolvedValue({}) }));

const today = new Date().toISOString().slice(0, 10);
const task = (over: Partial<DailyTask> = {}): DailyTask =>
  ({
    id: 'k1',
    goalId: 'skill',
    weekNumber: 1,
    dayNumber: 1,
    date: today,
    title: 'Chord changes to a metronome',
    detailedSteps: JSON.stringify([{ stepNumber: 1, title: 'Warm up', durationMinutes: 5, instructions: '', focusCue: '', pitfallToAvoid: '' }]),
    durationMinutes: 20,
    isRestDay: false,
    status: 'pending',
    ...over,
  }) as DailyTask;
const skill = (tasks: DailyTask[]) => ({ id: 'skill', rawGoal: 'Play 5 Songs on Acoustic Guitar', currentWeek: 2, dailyTasks: tasks }) as unknown as Goal;

vi.mock('../../context/GoalContext', () => ({
  useGoal: () => ({ activeGoal: { id: 'main', alongsideGoal: skill([task()]) }, updateActiveGoal: ctx.update, refreshGoal: ctx.refresh }),
}));

describe('AlongsideToday (ND-41)', () => {
  beforeEach(() => {
    ctx.update.mockReset();
    vi.mocked(updateDailyTask).mockReset();
  });

  it('shows the skill’s step today under the main one, and marks it done in the skill’s plan', async () => {
    vi.mocked(updateDailyTask).mockResolvedValue(task({ status: 'completed' }));
    render(<AlongsideToday goal={skill([task()])} />);
    expect(screen.getByRole('heading', { name: 'Play 5 Songs on Acoustic Guitar' })).toBeInTheDocument();
    expect(screen.getByText('Also today · Week 2')).toBeInTheDocument();
    expect(screen.getByText('Chord changes to a metronome')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Steps' })).toHaveTextContent('Warm up · 5 min');
    await userEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(updateDailyTask).toHaveBeenCalledWith('k1', { status: 'completed' }, 't');
    expect(ctx.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'main', alongsideGoal: expect.objectContaining({ dailyTasks: [expect.objectContaining({ status: 'completed' })] }) }),
    );
  });

  it('a done step can be undone, and a rest day says so', () => {
    const { unmount } = render(<AlongsideToday goal={skill([task({ status: 'completed' })])} />);
    expect(screen.getByText('Done for today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    unmount();
    render(<AlongsideToday goal={skill([task({ isRestDay: true })])} />);
    expect(screen.getByText(/Nothing for this skill today/)).toBeInTheDocument();
  });

  it('once its last week is over, finishes the skill (ND-41)', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const ended = { ...skill([task({ date: yesterday })]), currentWeek: 12 } as Goal;
    render(<AlongsideToday goal={ended} />);
    expect(screen.getByText(/reached the end of this skill’s plan/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Finish this skill' }));
    expect(completeGoal).toHaveBeenCalledWith('t', undefined, 'alongside');
    expect(ctx.refresh).toHaveBeenCalled();
  });
});
