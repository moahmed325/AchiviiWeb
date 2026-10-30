import { describe, it, expect, vi, beforeEach } from 'vitest';

// No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md section 7): the week writer is told what last
// week was like, from its days: sessions done and planned, the key sessions skipped, how the done sessions felt, the
// notes word for word, and the weekly review's reflection.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn().mockResolvedValue([]),
}));

import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { lastWeekOf, readFeel, writeNextWeek } from '../src/lib/planV2.js';

const goal = {
  id: 'g1',
  rawGoal: 'Learn to paint',
  clarifiedOutcome: 'Paint a landscape',
  startDate: new Date('2026-09-21T00:00:00Z'),
  routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
  roadmap: { finalGoal: 'Paint a landscape', startingPoint: {}, method: { name: 'Studies', creator: '', rules: [] }, phases: [{ name: 'Base', purpose: '' }], answers: [] },
  roadmapWeeks: [
    { weekNumber: 1, phase: 'Base', theme: 'Values' },
    { weekNumber: 2, phase: 'Base', theme: 'Colour' },
  ],
} as never;

const day = (dayOfWeek: string, over: Record<string, unknown> = {}) =>
  ({
    id: `t-${dayOfWeek}`,
    weekNumber: 1,
    dayOfWeek,
    title: `${dayOfWeek} study`,
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    notOffered: false,
    status: 'completed',
    usedMinimumVersion: false,
    notes: null,
    feel: null,
    ...over,
  }) as never;

const WEEK = [
  day('Monday', { feel: 'too_hard', notes: 'my wrist hurt' }),
  day('Tuesday', { feel: 'just_right' }),
  day('Wednesday', { isKeySession: true, status: 'pending', feel: 'too_easy' }),
  day('Thursday', { isRestDay: true, notes: '  ' }),
  day('Friday', { isKeySession: true, usedMinimumVersion: true }),
  day('Saturday', { notOffered: true, status: 'pending' }),
  // A test day stored before the weekly tests went counts as an ordinary session.
  day('Sunday', { isTestDay: true, status: 'pending', notes: 'ran out of time' }),
];

beforeEach(() => vi.mocked(generateWeekPlan).mockClear());

describe('lastWeekOf', () => {
  it('counts practice sessions (no rest days, no days not offered), taps on done sessions only, notes with their day', () => {
    expect(lastWeekOf(WEEK)).toEqual({
      done: 3,
      planned: 5,
      keySessionsSkipped: ['Wednesday: Wednesday study', 'Friday: Friday study'],
      feel: { too_easy: 0, just_right: 1, too_hard: 1 },
      notes: ['Monday: my wrist hurt', 'Sunday: ran out of time'],
    });
  });

  it('adds the reflection only when there is one', () => {
    expect(lastWeekOf(WEEK, '  Busy week ')).toMatchObject({ reflection: 'Busy week' });
    expect(lastWeekOf(WEEK, '   ')).not.toHaveProperty('reflection');
  });

  it('readFeel keeps the three taps and nothing else', () => {
    expect(['too_easy', 'just_right', 'too_hard', 'great', '', null, 3].map(readFeel)).toEqual(['too_easy', 'just_right', 'too_hard', null, null, null, null]);
  });
});

describe('writeNextWeek tells the writer last week', () => {
  it('from the finished week, with the review reflection', async () => {
    await writeNextWeek(goal, 1, WEEK, '19:30', null, [], { reflection: 'Busy week' });
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0];
    expect(input.lastWeek).toEqual({ ...lastWeekOf(WEEK), reflection: 'Busy week' });
    expect(input).not.toHaveProperty('target');
    expect(input).not.toHaveProperty('test');
  });

  it('nothing for a week with no tasks', async () => {
    await writeNextWeek(goal, 1, [], '19:30');
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0].lastWeek).toBeUndefined();
  });
});
