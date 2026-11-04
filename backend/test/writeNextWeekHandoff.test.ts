import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Method-aware recovery M3.1d (MR-32 (7)): writeNextWeek and the handoff. With METHOD_RECOVERY_ENABLED off the week call
// gets exactly today's input and the week comes back exactly as written; with it on, the writer is told where the person
// is and code places the carried steps. The week call fails and succeeds exactly as before.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

const placement = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/lib/recovery/handoff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/recovery/handoff.js')>();
  return {
    ...actual,
    placeHandoff: (...args: Parameters<typeof actual.placeHandoff>) => {
      if (placement.fail) throw new Error('placement broke');
      return actual.placeHandoff(...args);
    },
  };
});

import type { CarriedStep } from '../src/lib/carryForward.js';
import { generateWeekPlan, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { writeNextWeek } from '../src/lib/planV2.js';
import { handoffBrief, weekHandoff } from '../src/lib/recovery/handoff.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

const LANGUAGE = RECOVERY_TEMPLATES.language;
const lessonKind = LANGUAGE.kinds.find((k) => k.inOrder && k.action === 'move')!.id;
const otherKind = LANGUAGE.kinds.find((k) => !k.inOrder && k.action === 'let_go')!.id;

const target = { kind: 'number', metric: 'Words', value: 100, unit: 'words', direction: 'higher_is_better' };
const test = { type: 'quiz', instructions: 'Take the quiz', passIf: '80%' };
const method = { name: 'Lessons', creator: '', rules: ['One lesson at a time'] };
const NO_TAPS = { too_easy: 0, just_right: 0, too_hard: 0 };

const goal = (recovery: unknown, weeks = [1, 2]) =>
  ({
    id: 'g1',
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: new Date('2026-09-21T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
    roadmap: { finalGoal: 'Hold a conversation', finalTest: '', startingPoint: {}, method, phases: [{ name: 'Base', purpose: 'Build.' }], answers: [], ...(recovery ? { recovery } : {}) },
    // A goal made before the weekly tests went still stores a target and a test; neither reaches the writer.
    roadmapWeeks: weeks.map((weekNumber) => ({ weekNumber, phase: 'Base', theme: `Theme ${weekNumber}`, target, test })),
  }) as never;

const step = (title: string, priority: number, minutes: number, kind: string): CarriedStep => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  kind,
});

let n = 0;
const task = (over: Record<string, unknown>, steps: CarriedStep[]) =>
  ({
    id: `t${++n}`,
    weekNumber: 1,
    dayNumber: n,
    date: `2026-09-${String(20 + n).padStart(2, '0')}`,
    dayOfWeek: 'Monday',
    title: `Session ${n}`,
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    status: 'completed',
    usedMinimumVersion: false,
    notes: null,
    detailedSteps: JSON.stringify(steps),
    ...over,
  }) as never;

/** Week 1: Lesson 1 done, Lessons 2 and 3 not done. */
function finished() {
  n = 0;
  return [
    task({ dayOfWeek: 'Monday' }, [step('Lesson 1', 1, 20, lessonKind), step('Mon notes', 2, 10, otherKind)]),
    task({ dayOfWeek: 'Tuesday', status: 'pending' }, [step('Lesson 2', 1, 20, lessonKind), step('Tue notes', 2, 10, otherKind)]),
    task({ dayOfWeek: 'Wednesday', status: 'pending' }, [step('Lesson 3', 1, 20, lessonKind), step('Wed notes', 2, 10, otherKind)]),
  ];
}

/** What the call returns: Monday and Wednesday hold a lesson of the model's own. */
function written(): WeekDayPlan[] {
  const dayPlan = (dayNumber: number, date: string, steps: CarriedStep[]): WeekDayPlan => ({
    dayNumber,
    date,
    dayOfWeek: 'Day',
    title: `Day ${dayNumber}`,
    isRestDay: false,
    durationMinutes: 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: steps,
    isKeySession: false,
    isTestDay: false,
    whyToday: '',
    minimumVersion: null,
  });
  return [
    dayPlan(1, '2026-09-28', [step('Model lesson A', 1, 20, lessonKind), step('Day 1 notes', 2, 10, otherKind)]),
    dayPlan(2, '2026-09-29', [step('Day 2 notes', 1, 30, otherKind)]),
    dayPlan(3, '2026-09-30', [step('Model lesson B', 1, 20, lessonKind), step('Day 3 notes', 2, 10, otherKind)]),
  ];
}

/** Today's input for the fixture, built field by field as `writeNextWeek` did before M3.1d. */
const todaysInput = (recovery: unknown) => ({
  finalGoal: 'Hold a conversation',
  answers: [],
  dailyMinutes: 30,
  planVariant: 'steady',
  slotTime: '19:30',
  method,
  weekNumber: 2,
  totalWeeks: 12,
  phase: { name: 'Base', purpose: 'Build.' },
  focus: 'Theme 2',
  weekStart: new Date('2026-09-28T00:00:00Z'),
  highLoadGoal: false,
  recovery,
  lastWeek: { done: 1, planned: 3, keySessionsSkipped: [], feel: NO_TAPS, notes: [] },
  // Plan safety limits M2.2a (B-64): the goal id for the `[Safety]` lines; the prompt never reads it.
  goalId: 'g1',
});

const call = () => vi.mocked(generateWeekPlan).mock.calls.at(-1)![0];

beforeEach(() => {
  vi.mocked(generateWeekPlan).mockReset();
  placement.fail = false;
});
afterEach(() => vi.unstubAllEnvs());

describe('writeNextWeek with the method switch off (requirement 1)', () => {
  for (const value of [undefined, 'false', 'TRUE', '1']) {
    it(`METHOD_RECOVERY_ENABLED=${value ?? '(unset)'}: exactly today's input, and the week exactly as written`, async () => {
      if (value !== undefined) vi.stubEnv('METHOD_RECOVERY_ENABLED', value);
      else vi.stubEnv('METHOD_RECOVERY_ENABLED', undefined as unknown as string);
      const week = written();
      vi.mocked(generateWeekPlan).mockResolvedValue(week);
      const result = await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30');
      expect(call()).toStrictEqual(todaysInput(LANGUAGE));
      expect(result).toBe(week);
      expect(JSON.stringify(result)).toBe(JSON.stringify(written()));
    });
  }

  it('the week call failing still gives null', async () => {
    vi.mocked(generateWeekPlan).mockResolvedValue(null);
    expect(await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30')).toBeNull();
  });
});

describe('writeNextWeek with the method switch on (M3.1d)', () => {
  beforeEach(() => vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true'));

  it('tells the writer where the person is, and places Lessons 2 and 3 in the first lesson sessions', async () => {
    vi.mocked(generateWeekPlan).mockResolvedValue(written());
    const result = (await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30'))!;
    const tasks = finished().map((t: { detailedSteps: string }) => ({ ...(t as object), steps: JSON.parse(t.detailedSteps) })) as never[];
    const brief = handoffBrief(weekHandoff({ tasks, profile: LANGUAGE }));
    expect(brief[0]).toContain('in this order: "Lesson 2", "Lesson 3". They are at "Lesson 2", 2 steps behind the plan.');
    expect(call()).toStrictEqual({ ...todaysInput(LANGUAGE), whereTheyAre: brief });
    expect(result.map((d) => d.detailedSteps[0].title)).toEqual(['Lesson 2', 'Day 2 notes', 'Lesson 3']);
    expect((result[0].detailedSteps[0] as CarriedStep).shiftedFrom).toMatchObject({ taskId: 't2', date: '2026-09-22' });
  });

  it('logs one line per kind whose steps wait, with why (M3.1d review fix 5)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    // No lesson session at all: both carried lessons wait, no_session.
    vi.mocked(generateWeekPlan).mockResolvedValue(written().map((d) => ({ ...d, detailedSteps: [step(`Day ${d.dayNumber} notes`, 1, 30, otherKind)] })));
    await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30');
    expect(info).toHaveBeenCalledWith(`[Recovery] Handoff wait: goal g1 week 2 kind ${lessonKind} waiting 2 no_session`);
    info.mockClear();
    // One lesson session: Lesson 2 is placed, Lesson 3 waits, sessions_full.
    vi.mocked(generateWeekPlan).mockResolvedValue(written().slice(0, 2));
    await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30');
    expect(info).toHaveBeenCalledWith(`[Recovery] Handoff wait: goal g1 week 2 kind ${lessonKind} waiting 1 sessions_full`);
    info.mockClear();
    // Everything placed: no line.
    vi.mocked(generateWeekPlan).mockResolvedValue(written());
    await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30');
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('nothing to say: the input has no new field and the week comes back as written', async () => {
    vi.mocked(generateWeekPlan).mockResolvedValue(written());
    n = 0;
    const allDone = [task({}, [step('Lesson 1', 1, 20, lessonKind), step('Mon notes', 2, 10, otherKind)])];
    const result = await writeNextWeek(goal(LANGUAGE), 1, allDone, '19:30');
    expect(call()).toStrictEqual({ ...todaysInput(LANGUAGE), lastWeek: { done: 1, planned: 1, keySessionsSkipped: [], feel: NO_TAPS, notes: [] } });
    expect(result).toEqual(written());
  });

  it('a goal without a profile is exactly as with the switch off (RULE-18)', async () => {
    const week = written();
    vi.mocked(generateWeekPlan).mockResolvedValue(week);
    const result = await writeNextWeek(goal(null), 1, finished(), '19:30');
    expect(call()).toStrictEqual(todaysInput(null));
    expect(result).toBe(week);
  });

  it('no new failure: the call failing gives null as before, and a placement that throws keeps the week as written', async () => {
    vi.mocked(generateWeekPlan).mockResolvedValue(null);
    expect(await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30')).toBeNull();

    placement.fail = true;
    const week = written();
    vi.mocked(generateWeekPlan).mockResolvedValue(week);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await writeNextWeek(goal(LANGUAGE), 1, finished(), '19:30')).toBe(week);
    expect(error).toHaveBeenCalledWith('[PlanV2] Could not place what last week hands on:', expect.any(Error));
    error.mockRestore();
  });

  it('a broken stored week is read as nothing to hand on, never an error', async () => {
    vi.mocked(generateWeekPlan).mockResolvedValue(written());
    n = 0;
    const broken = [task({ status: 'pending', detailedSteps: '{not json' }, [])];
    const result = await writeNextWeek(goal(LANGUAGE), 1, broken, '19:30');
    expect(call()).not.toHaveProperty('whereTheyAre');
    expect(result).toEqual(written());
  });

  it('no handoff after week 12: there is no week 13 to write', async () => {
    expect(await writeNextWeek(goal(LANGUAGE, [11, 12]), 12, finished(), '19:30')).toBeNull();
    expect(generateWeekPlan).not.toHaveBeenCalled();
  });
});
