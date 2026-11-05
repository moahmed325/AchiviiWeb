import { describe, it, expect, vi, beforeEach } from 'vitest';

// No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md section 7): the week writer is told what last
// week was like, from its days: sessions done and planned, the key sessions skipped, how the done sessions felt, the
// notes word for word. B-110: no weekly review reflection, as weeks close only automatically.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn().mockResolvedValue([]),
}));

import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { MAIN_STEPS_NOT_DONE_MAX, WRITER_NOTE_MAX_CHARS, lastWeekOf, mainStepsNotDoneOf, readFeel, writeNextWeek } from '../src/lib/planV2.js';

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

  it('each note goes on one line, cut to its limit', () => {
    const long = [day('Monday', { notes: `line one\n\nline two ${'x'.repeat(WRITER_NOTE_MAX_CHARS)}` })];
    const [note] = lastWeekOf(long).notes;
    expect(note.startsWith('Monday: line one line two x')).toBe(true);
    expect(note).not.toContain('\n');
    expect(note.length).toBe('Monday: '.length + WRITER_NOTE_MAX_CHARS);
    expect(note.endsWith('…')).toBe(true);
  });

  it('readFeel keeps the three taps and nothing else', () => {
    expect(['too_easy', 'just_right', 'too_hard', 'great', '', null, 3].map(readFeel)).toEqual(['too_easy', 'just_right', 'too_hard', null, null, null, null]);
  });
});

describe('mainStepsNotDoneOf (ND-38)', () => {
  const steps = (...items: Array<[string, number, Record<string, unknown>?]>) =>
    JSON.stringify(items.map(([title, priority, extra]) => ({ stepNumber: priority, title, durationMinutes: 10, instructions: '', priority, ...extra })));
  const at = (dayOfWeek: string, date: string, over: Record<string, unknown>) => day(dayOfWeek, { date, ...over });

  it('names each day not done by its main step, most recent first; never a step done elsewhere, handed on, or a key session', () => {
    const week = [
      at('Monday', '2026-09-21', { status: 'pending', detailedSteps: steps(['Side', 2], ['Scales', 1]) }),
      // Tuesday's main step was moved to Friday and done there.
      at('Tuesday', '2026-09-22', { status: 'pending', detailedSteps: steps(['Chords', 1], ['Ear', 2]) }),
      at('Wednesday', '2026-09-23', { status: 'pending', isKeySession: true, detailedSteps: steps(['Full song', 1]) }),
      at('Thursday', '2026-09-24', { status: 'pending', detailedSteps: steps(['Lesson 4', 1, { toNextWeek: [{ taskId: 'x', date: '2026-09-24', step: { title: 'Lesson 4' } }] }]) }),
      at('Friday', '2026-09-25', { status: 'completed', detailedSteps: steps(['Strum', 1], ['Chords', 2]) }),
      at('Saturday', '2026-09-26', { status: 'pending', isRestDay: true, detailedSteps: steps(['Rest', 1]) }),
      at('Sunday', '2026-09-27', { status: 'pending', notOffered: true, detailedSteps: steps(['Riffs', 1]) }),
    ];
    expect(mainStepsNotDoneOf(week)).toEqual(['Monday: Scales']);
    expect(lastWeekOf(week).mainStepsNotDone).toEqual(['Monday: Scales']);
  });

  it('never an old test step (priority 0 or "Weekly test:"); a day done only through its 10-minute version did not do its steps', () => {
    const week = [
      at('Monday', '2026-09-21', { status: 'pending', detailedSteps: steps(['Weekly test: 5 km', 0], ['Warm up', 2]) }),
      at('Tuesday', '2026-09-22', { status: 'pending', detailedSteps: steps(['Weekly test: plank', 1], ['Core', 2]) }),
      // Wednesday's main step was moved to Thursday, done there only through the 10-minute version.
      at('Wednesday', '2026-09-23', { status: 'pending', detailedSteps: steps(['Hill repeats', 1], ['Drills', 2]) }),
      at('Thursday', '2026-09-24', { status: 'completed', usedMinimumVersion: true, detailedSteps: steps(['Easy run', 1], ['Hill repeats', 2]) }),
    ];
    expect(mainStepsNotDoneOf(week)).toEqual(['Thursday: Easy run', 'Wednesday: Hill repeats', 'Tuesday: Core', 'Monday: Warm up']);
  });

  it(`at most ${MAIN_STEPS_NOT_DONE_MAX}, and absent when there are none`, () => {
    const many = Array.from({ length: 7 }, (_, i) => at(`Day${i}`, `2026-09-2${i + 1}`, { status: 'pending', detailedSteps: steps([`Step ${i}`, 1]) }));
    expect(mainStepsNotDoneOf(many)).toEqual(['Day6: Step 6', 'Day5: Step 5', 'Day4: Step 4', 'Day3: Step 3', 'Day2: Step 2']);
    expect(lastWeekOf(WEEK)).not.toHaveProperty('mainStepsNotDone');
  });
});

describe('writeNextWeek tells the writer last week', () => {
  it('from the finished week', async () => {
    await writeNextWeek(goal, 1, WEEK, '19:30', null, []);
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0];
    expect(input.lastWeek).toEqual(lastWeekOf(WEEK));
    expect(input.lastWeek).not.toHaveProperty('reflection');
    expect(input).not.toHaveProperty('target');
    expect(input).not.toHaveProperty('test');
  });

  it('ND-38: the main steps not done, except in a first week back after a break', async () => {
    const missed = [day('Monday', { date: '2026-09-21', status: 'pending', detailedSteps: JSON.stringify([{ stepNumber: 1, title: 'Values study', durationMinutes: 20, instructions: '', priority: 1 }]) })];
    await writeNextWeek(goal, 1, missed, '19:30', null, []);
    expect(vi.mocked(generateWeekPlan).mock.calls.at(-1)![0].lastWeek!.mainStepsNotDone).toEqual(['Monday: Values study']);
    await writeNextWeek(goal, 1, missed, '19:30', null, [], { firstWeekBack: { awayDays: 10, length: '1-2 weeks', note: null, highLoad: false, everyStep: false } as never });
    expect(vi.mocked(generateWeekPlan).mock.calls.at(-1)![0].lastWeek).not.toHaveProperty('mainStepsNotDone');
  });

  it('nothing for a week with no tasks', async () => {
    await writeNextWeek(goal, 1, [], '19:30');
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0].lastWeek).toBeUndefined();
  });
});
