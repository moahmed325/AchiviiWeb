import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Goal } from '../../types';
import { ApiError, updateSchedule } from '../../lib/api';
import { EditScheduleDialog } from './EditScheduleDialog';

// Edit my schedule (B-108): what the dialog sends and says. The menu that opens it is tested in AppShell.test.tsx.

vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), updateSchedule: vi.fn() }));
const refreshGoal = vi.fn(async () => {});
let goal: Goal;
vi.mock('../../context/GoalContext', () => ({ useGoal: () => ({ activeGoal: goal, refreshGoal }) }));
vi.mock('../../context/AuthContext', () => ({ useAuthToken: () => 't' }));

const GOAL = {
  id: 'g1',
  currentWeek: 3,
  startDate: '2026-09-21T00:00:00.000Z',
  schedule: { planVariant: 'steady', dailyMinutes: 45, preferredSlot: 'evening', restWeekdays: [0, 4], restWeekdaysChosen: false },
} as unknown as Goal;

const open = () => {
  render(<EditScheduleDialog open onOpenChange={() => {}} />);
  return screen.getByRole('dialog', { name: 'Edit my schedule' });
};

beforeEach(() => {
  vi.clearAllMocks();
  goal = GOAL;
  vi.mocked(updateSchedule).mockResolvedValue({ startsWeek: 4, startsOn: '2026-10-12' });
});

describe('EditScheduleDialog', () => {
  it('changing only the time of day leaves the rest days out, so they keep following the plan (code review)', async () => {
    const dialog = open();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Morning' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
    expect(updateSchedule).toHaveBeenCalledWith({ planVariant: 'steady', dailyMinutes: 45, preferredSlot: 'morning' }, 't');
    expect(refreshGoal).toHaveBeenCalled();
  });

  it('a new number of days not picked goes back to its own rest days; picked days are sent', async () => {
    const dialog = open();
    await userEvent.click(within(dialog).getByRole('radio', { name: '4 days' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
    expect(updateSchedule).toHaveBeenLastCalledWith({ planVariant: 'minimal', dailyMinutes: 45, preferredSlot: 'evening', restWeekdays: null }, 't');
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Mon' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Fri' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
    expect(vi.mocked(updateSchedule).mock.lastCall?.[0]).toHaveProperty('restWeekdays');
  });

  it('keeps a shortened daily time as an option', () => {
    goal = { ...GOAL, schedule: { ...GOAL.schedule!, dailyMinutes: 20 } } as Goal;
    const dialog = open();
    expect(within(dialog).getByRole('radio', { name: '20 min' })).toBeChecked();
  });

  it('shows the server\'s reason when a save is refused', async () => {
    vi.mocked(updateSchedule).mockRejectedValue(new ApiError('Your next week is being prepared. Open Today first, then change your schedule.', 409, 'week_closing'));
    const dialog = open();
    await userEvent.click(within(dialog).getByRole('radio', { name: '60 min' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save schedule' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Your next week is being prepared.');
  });
});
