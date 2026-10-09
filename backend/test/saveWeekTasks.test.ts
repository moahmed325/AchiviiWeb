import { describe, it, expect, vi, beforeEach } from 'vitest';

// B-13: saveWeekTasks replaces a week's rows in one transaction. The mock keeps rows in memory and rolls them back
// when the transaction callback throws, the way Postgres would.
const db = vi.hoisted(() => {
  type Row = { goalId: string; weekNumber: number; dayNumber: number; title: string };
  const state = { rows: [] as Row[], failCreate: false };
  const matches = (where: { goalId: string; weekNumber: number }) => (row: Row) =>
    row.goalId === where.goalId && row.weekNumber === where.weekNumber;
  const tx = {
    dailyTask: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.rows.length;
        state.rows = state.rows.filter((row) => !matches(where)(row));
        return { count: before - state.rows.length };
      }),
      createMany: vi.fn(async ({ data }: any) => {
        if (state.failCreate) throw new Error('createMany failed');
        state.rows.push(...data);
        return { count: data.length };
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      const snapshot = [...state.rows];
      try {
        return await fn(tx);
      } catch (err) {
        state.rows = snapshot;
        throw err;
      }
    }),
    dailyTask: {
      // Writes outside the transaction would show up here.
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(async ({ where }: any) =>
        state.rows.filter(matches(where)).sort((a, b) => a.dayNumber - b.dayNumber)
      ),
    },
  };
  return { state, tx, prisma };
});

vi.mock('../src/lib/prisma.js', () => ({ prisma: db.prisma }));

import { saveWeekTasks } from '../src/lib/planV2.js';
import type { WeekDayPlan } from '../src/lib/ai/weekPlan.js';

const day = (dayNumber: number, title: string) =>
  ({
    dayNumber,
    date: `2026-10-${String(11 + dayNumber).padStart(2, '0')}`,
    dayOfWeek: 'Monday',
    title,
    isRestDay: false,
    durationMinutes: 30,
    implementationIntention: 'After coffee, practise.',
    detailedSteps: [],
    isKeySession: false,
    isTestDay: false,
  }) as unknown as WeekDayPlan;

const oldWeek = () => [
  { goalId: 'goal-1', weekNumber: 2, dayNumber: 8, title: 'Old day 1' },
  { goalId: 'goal-1', weekNumber: 2, dayNumber: 9, title: 'Old day 2' },
  { goalId: 'goal-1', weekNumber: 3, dayNumber: 15, title: 'Other week' },
];

describe('saveWeekTasks (B-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.state.rows = oldWeek();
    db.state.failCreate = false;
  });

  it('deletes and creates the week inside one transaction, then returns the new rows', async () => {
    const result = await saveWeekTasks('goal-1', 2, [day(2, 'New day 2'), day(1, 'New day 1')]);

    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.tx.dailyTask.deleteMany).toHaveBeenCalledWith({ where: { goalId: 'goal-1', weekNumber: 2 } });
    expect(db.tx.dailyTask.createMany).toHaveBeenCalledTimes(1);
    expect(db.prisma.dailyTask.deleteMany).not.toHaveBeenCalled();
    expect(db.prisma.dailyTask.createMany).not.toHaveBeenCalled();
    expect(result.map((row: any) => row.title)).toEqual(['New day 1', 'New day 2']);
    expect(db.state.rows.find((row) => row.weekNumber === 3)?.title).toBe('Other week');
  });

  it('leaves the old week in place when the create fails', async () => {
    db.state.failCreate = true;

    await expect(saveWeekTasks('goal-1', 2, [day(1, 'New day 1')])).rejects.toThrow('createMany failed');

    expect(db.tx.dailyTask.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.state.rows).toEqual(oldWeek());
    expect(db.prisma.dailyTask.findMany).not.toHaveBeenCalled();
  });
});
