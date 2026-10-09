import { describe, it, expect, vi, beforeEach } from 'vitest';

// Method-aware recovery M2.1: writeNextWeek gives the week call the goal's profile: the one it is handed (the
// review passes the one ensureRecoveryProfile returned), or the stored one when none is handed.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn().mockResolvedValue([]),
}));

import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

const target = { kind: 'number', metric: 'Speed', value: 20, unit: 'wpm', direction: 'higher_is_better' };
const test = { type: 'typing_test', instructions: 'Type for 1 minute', passIf: '20 wpm' };
const method = { name: 'Keybr', creator: '', rules: ['Accuracy first'] };

const goal = (recovery?: unknown) =>
  ({
    id: 'g1',
    rawGoal: 'Type 40 words per minute',
    clarifiedOutcome: 'Type 40 wpm',
    startDate: new Date('2026-09-21T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
    roadmap: { finalGoal: 'Type 40 wpm', finalTest: '', startingPoint: {}, method, phases: [{ name: 'Base', purpose: 'Build.' }], answers: [], ...(recovery ? { recovery } : {}) },
    roadmapWeeks: [
      { weekNumber: 1, phase: 'Base', theme: 'Home row', target, test },
      { weekNumber: 2, phase: 'Base', theme: 'Top row', target, test },
    ],
  }) as never;

const passed = () => vi.mocked(generateWeekPlan).mock.calls.at(-1)![0].recovery;

beforeEach(() => vi.clearAllMocks());

describe('writeNextWeek and the profile', () => {
  it('reads the stored profile when none is handed', async () => {
    await writeNextWeek(goal(RECOVERY_TEMPLATES.general), 1, [], '19:30');
    expect(passed()).toEqual(RECOVERY_TEMPLATES.general);
  });

  it('uses the profile it is handed, even when the loaded goal does not hold it yet', async () => {
    await writeNextWeek(goal(), 1, [], '19:30', RECOVERY_TEMPLATES.creative);
    expect(passed()).toEqual(RECOVERY_TEMPLATES.creative);
  });

  it('passes none for a goal without a readable profile, or when handed null', async () => {
    await writeNextWeek(goal(), 1, [], '19:30');
    expect(passed()).toBeNull();
    await writeNextWeek(goal({ version: 1, kinds: 'broken' }), 1, [], '19:30');
    expect(passed()).toBeNull();
    await writeNextWeek(goal(RECOVERY_TEMPLATES.general), 1, [], '19:30', null);
    expect(passed()).toBeNull();
  });
});
