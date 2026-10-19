import { describe, it, expect } from 'vitest';
import type { CarriedStep } from '../src/lib/carryForward.js';
import type { DayClassification, DayKind } from '../src/lib/missedSessions.js';
import { EASY_START_LINE, FIRST_WEEK_BACK_LINE, easyLineAfterSwap, easyLineTarget } from '../src/lib/recovery/easyStart.js';
import { PROFILE } from './methodProfile.js';

// B-49: RULE-21's target, shared by the carry planner and the swap route, and where the line goes after a swap.

const step = (title: string, kind: string, line = false): CarriedStep =>
  ({ stepNumber: 1, title, durationMinutes: 15, instructions: line ? `${EASY_START_LINE}\nDo ${title}.` : `Do ${title}.`, focusCue: '', priority: 1, kind }) as CarriedStep;

/** Mon to Wed missed (the gap), Thu today, Fri and Sun open, Sat the test day. */
const DAYS: DayClassification[] = (
  [
    ['mon', '2026-09-21', 'missed'],
    ['tue', '2026-09-22', 'missed'],
    ['wed', '2026-09-23', 'missed'],
    ['thu', '2026-09-24', 'planned'],
    ['fri', '2026-09-25', 'planned'],
    ['sat', '2026-09-26', 'planned'],
    ['sun', '2026-09-27', 'planned'],
  ] as Array<[string, string, DayKind]>
).map(([taskId, date, kind], index) => ({ taskId, date, kind, weekNumber: 1, dayNumber: index + 1, isKeySession: false, isTestDay: taskId === 'sat' }));
const GAP = { firstDate: '2026-09-21', lastDate: '2026-09-23', length: 3, taskIds: ['mon', 'tue', 'wed'] };
const base = { days: DAYS, gap: GAP, today: '2026-09-24', profile: PROFILE };

const rows = (spec: Record<string, CarriedStep[]>) =>
  new Map(DAYS.map((day) => [day.taskId, spec[day.taskId] ?? (day.taskId === 'sat' ? [step('Weekly test', 'weekly_test')] : [step(`${day.taskId} practice`, 'practice')])]));
/** The two days' rows exchanged. */
const swapped = (before: Map<string, CarriedStep[]>, a: string, b: string) => new Map([...before, [a, before.get(b)!], [b, before.get(a)!]]);
const titlesWithLine = (changes: Map<string, CarriedStep[]>) =>
  [...changes].flatMap(([id, steps]) => steps.filter((s) => String(s.instructions).startsWith(EASY_START_LINE)).map((s) => [id, s.title]));

describe('easyLineTarget (RULE-21)', () => {
  it('the first hard step on the first open practice day back; none without a gap or a hard step', () => {
    const before = rows({ fri: [step('fri intervals', 'heavy')] });
    expect(easyLineTarget(base, (id) => before.get(id)!)).toMatchObject({ day: { taskId: 'fri' }, index: 0 });
    expect(easyLineTarget({ ...base, gap: null }, (id) => before.get(id)!)).toBeNull();
    expect(easyLineTarget(base, (id) => rows({}).get(id)!)).toBeNull();
  });
});

describe('easyLineAfterSwap (B-49)', () => {
  it('a hard step swapped onto today takes the line; the step it came from loses it', () => {
    const before = rows({ fri: [step('fri intervals', 'heavy', true)], sun: [step('sun hills', 'heavy')] });
    const changes = easyLineAfterSwap({ ...base, swapped: ['thu', 'sun'], before, after: swapped(before, 'thu', 'sun') });
    expect([...changes.keys()].sort()).toEqual(['fri', 'thu']);
    expect(titlesWithLine(changes)).toEqual([['thu', 'sun hills']]);
    expect(changes.get('fri')![0].instructions).toBe('Do fri intervals.');
  });

  it('the line already on the step that moved onto the target: nothing changes', () => {
    const before = rows({ fri: [step('fri intervals', 'heavy', true)] });
    expect(easyLineAfterSwap({ ...base, swapped: ['thu', 'fri'], before, after: swapped(before, 'thu', 'fri') }).size).toBe(0);
  });

  it('a swap that touches neither the line nor the target changes nothing, even when the line is elsewhere', () => {
    const before = rows({ fri: [step('fri intervals', 'heavy', true)] });
    expect(easyLineAfterSwap({ ...base, swapped: ['thu', 'sun'], before, after: swapped(before, 'thu', 'sun') }).size).toBe(0);
  });

  it('no gap, no profile: nothing changes', () => {
    const before = rows({ sun: [step('sun hills', 'heavy')] });
    const after = swapped(before, 'thu', 'sun');
    expect(easyLineAfterSwap({ ...base, gap: null, swapped: ['thu', 'sun'], before, after }).size).toBe(0);
    expect(easyLineAfterSwap({ ...base, profile: null, swapped: ['thu', 'sun'], before, after }).size).toBe(0);
  });

  it('M1.5a (WU-35 (2)): a swap leaves the first-week-back line where it is and adds no easy line beside it', () => {
    const back = (title: string): CarriedStep => ({ ...step(title, 'heavy'), instructions: `${FIRST_WEEK_BACK_LINE}\nDo ${title}.` }) as CarriedStep;
    const before = rows({ fri: [back('fri intervals')], sun: [back('sun hills')] });
    const after = swapped(before, 'thu', 'sun');
    expect(easyLineAfterSwap({ ...base, swapped: ['thu', 'sun'], before, after }).size).toBe(0);
    expect(easyLineAfterSwap({ ...base, swapped: ['thu', 'fri'], before, after: swapped(before, 'thu', 'fri') }).size).toBe(0);
    expect(after.get('thu')![0].instructions).toBe(`${FIRST_WEEK_BACK_LINE}\nDo sun hills.`);
  });

  it("M1.5a: RULE-21's line moving to a target that holds the first-week-back line leaves its old step and is not added", () => {
    const back = { ...step('fri intervals', 'heavy'), instructions: `${FIRST_WEEK_BACK_LINE}\nDo fri intervals.` } as CarriedStep;
    const before = rows({ thu: [step('thu hills', 'heavy', true)], fri: [back] });
    const changes = easyLineAfterSwap({ ...base, swapped: ['thu', 'fri'], before, after: swapped(before, 'thu', 'fri') });
    // Thu now holds the first-week-back step (the target): it keeps only its own line; Fri's step loses RULE-21's line.
    expect(titlesWithLine(changes)).toEqual([]);
    expect(changes.get('fri')![0].instructions).toBe('Do thu hills.');
    expect(changes.has('thu')).toBe(false);
  });

  it('the only hard step back swapped later keeps its line: it is still the first hard step back', () => {
    const before = rows({ thu: [step('thu intervals', 'heavy', true)] });
    expect(easyLineAfterSwap({ ...base, swapped: ['thu', 'sun'], before, after: swapped(before, 'thu', 'sun') }).size).toBe(0);
  });
});
