import { describe, it, expect, vi, beforeEach } from 'vitest';

// Missed sessions M2.3 (OD-2): writeNextWeek reports a key session done only through the 10-minute version as
// skipped, while `done` still counts it (RULE-4, AC-7).

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn().mockResolvedValue([]),
}));

import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';

const target = { kind: 'number', metric: 'Speed', value: 20, unit: 'wpm', direction: 'higher_is_better' };
const test = { type: 'typing_test', instructions: 'Take a 1-minute typing test', passIf: '20 wpm' };

const goal = {
  id: 'g1',
  rawGoal: 'Type 40 words per minute',
  clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
  startDate: new Date('2026-09-21T00:00:00Z'),
  routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
  roadmap: { finalGoal: 'Type 40 wpm', finalTest: '', startingPoint: {}, method: { name: 'Drills', creator: '', rules: [] }, phases: [{ name: 'Base', purpose: '' }], answers: [] },
  roadmapWeeks: [
    { weekNumber: 1, phase: 'Base', theme: 'Home row', target, test },
    { weekNumber: 2, phase: 'Base', theme: 'Top row', target, test },
  ],
} as never;

let n = 0;
const task = (over: Record<string, unknown>) =>
  ({
    id: `t${++n}`,
    weekNumber: 1,
    dayOfWeek: 'Monday',
    title: `Session ${n}`,
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    status: 'pending',
    usedMinimumVersion: false,
    notes: null,
    ...over,
  }) as never;

async function lastWeekFor(tasks: never[]) {
  await writeNextWeek(goal, 1, tasks, '19:30');
  return vi.mocked(generateWeekPlan).mock.calls[0][0].lastWeek!;
}

beforeEach(() => vi.mocked(generateWeekPlan).mockClear());

describe('writeNextWeek key sessions (OD-2)', () => {
  it('a key session completed in full is done', async () => {
    const last = await lastWeekFor([task({ isKeySession: true, status: 'completed', dayOfWeek: 'Tuesday', title: 'Full' })]);
    expect(last.keySessionsSkipped).toEqual([]);
    expect(last.done).toBe(1);
  });

  it('a key session completed only through the 10-minute version is skipped, but still counts in done', async () => {
    const last = await lastWeekFor([
      task({ isKeySession: true, status: 'completed', usedMinimumVersion: true, dayOfWeek: 'Wednesday', title: 'Short' }),
    ]);
    expect(last.keySessionsSkipped).toEqual(['Wednesday: Short']);
    expect(last.done).toBe(1);
    expect(last.planned).toBe(1);
  });

  it('a pending key session is skipped', async () => {
    const last = await lastWeekFor([task({ isKeySession: true, status: 'pending', dayOfWeek: 'Thursday', title: 'Open' })]);
    expect(last.keySessionsSkipped).toEqual(['Thursday: Open']);
    expect(last.done).toBe(0);
  });

  it('a non-key 10-minute completion still counts in done (RULE-4, AC-7); rest days are not planned', async () => {
    const last = await lastWeekFor([
      task({ status: 'completed', usedMinimumVersion: true }),
      task({ status: 'completed' }),
      task({ status: 'pending' }),
      task({ isRestDay: true, status: 'completed' }),
    ]);
    expect(last.done).toBe(2);
    expect(last.planned).toBe(3);
    expect(last.keySessionsSkipped).toEqual([]);
  });
});
