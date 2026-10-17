import { describe, it, expect, vi, beforeEach } from 'vitest';

// B-61: the week writer is told last week's result from the logged `RoadmapWeek.testResult` first, then the test day's
// notes, so a result logged in the review or as a late test reaches it.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn().mockResolvedValue([]),
}));

import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';

const target = { kind: 'number', metric: 'Time', value: 30, unit: 'minutes', direction: 'higher_is_better' };
const test = { type: 'timed_run', instructions: 'Run as long as you can', passIf: '30 minutes' };

const goalWith = (testResult: unknown) =>
  ({
    id: 'g1',
    rawGoal: 'Run 10k',
    clarifiedOutcome: 'Run 10k',
    startDate: new Date('2026-09-21T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
    roadmap: { finalGoal: 'Run 10k', finalTest: '', startingPoint: {}, method: { name: 'Base', creator: '', rules: [] }, phases: [{ name: 'Base', purpose: '' }], answers: [] },
    roadmapWeeks: [
      { weekNumber: 1, phase: 'Base', theme: 'Easy', target, test, testResult },
      { weekNumber: 2, phase: 'Base', theme: 'Longer', target, test, testResult: null },
    ],
  }) as never;

const testDay = (over: Record<string, unknown> = {}) =>
  ({ id: 't1', weekNumber: 1, dayOfWeek: 'Sunday', title: 'Test', isRestDay: false, isKeySession: false, isTestDay: true, status: 'completed', usedMinimumVersion: false, notes: null, ...over }) as never;

async function resultFor(testResult: unknown, tasks: never[]) {
  await writeNextWeek(goalWith(testResult), 1, tasks, '19:30');
  return vi.mocked(generateWeekPlan).mock.calls[0][0].lastWeek!.result;
}

beforeEach(() => vi.mocked(generateWeekPlan).mockClear());

describe('writeNextWeek last week result (B-61)', () => {
  it('a logged result gives the value, unit, passed and its note', async () => {
    const result = await resultFor({ value: 31.5, unit: 'minutes', passed: true, note: 'Felt strong' }, [testDay({ notes: 'day note' })]);
    expect(result).toBe('test logged: 31.5 minutes, passed; their note: "Felt strong"');
  });

  it('a logged result without a note or unit takes the test day note, and says not passed', async () => {
    const result = await resultFor({ value: '28', passed: false }, [testDay({ notes: '  legs tired ' })]);
    expect(result).toBe('test logged: 28, not passed; their note: "legs tired"');
  });

  it('a logged result reaches the writer even when the test day is not marked done (a late test)', async () => {
    const result = await resultFor({ value: 30, unit: 'minutes', passed: true }, [testDay({ status: 'pending' })]);
    expect(result).toBe('test logged: 30 minutes, passed');
  });

  it('without a logged result the wording is exactly as before', async () => {
    expect(await resultFor(null, [testDay({ notes: 'ran 29 minutes' })])).toBe('test done; their note: "ran 29 minutes"');
    vi.mocked(generateWeekPlan).mockClear();
    expect(await resultFor(null, [testDay()])).toBe('test done, score not logged');
    vi.mocked(generateWeekPlan).mockClear();
    expect(await resultFor(undefined, [testDay({ status: 'pending' })])).toBe('the weekly test was not done');
    vi.mocked(generateWeekPlan).mockClear();
    expect(await resultFor(null, [])).toBe('no test day this week');
  });

  it('a stored result in an unusable shape falls back to the old wording', async () => {
    expect(await resultFor({ value: '', passed: true }, [testDay()])).toBe('test done, score not logged');
  });
});
