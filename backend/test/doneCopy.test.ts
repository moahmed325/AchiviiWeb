import { describe, it, expect } from 'vitest';
import type { CarriedStep } from '../src/lib/carryForward.js';
import type { DayClassification } from '../src/lib/missedSessions.js';
import { buildSignals } from '../src/lib/missedSignals.js';
import { doneStepsOf, isDoneCopy } from '../src/lib/recovery/inOrder.js';
import { markerRefusal } from '../src/lib/recovery/swap.js';

// B-55 (MR-36, MR-37 as changed): a moved step or a reorder's copy is ignored only when its source day is done and
// still holds that same step (the day it was written on plus its title). The screen's copy of this rule is tested
// alike in frontend `lib/todayRecovery.test.ts`.

const TUE = '2026-09-22';
const WED = '2026-09-23';
const FRI = '2026-09-25';
const step = (title: string, priority: number, extra: Record<string, unknown> = {}): CarriedStep =>
  ({ stepNumber: priority, title, durationMinutes: 20, instructions: `Do ${title}.`, focusCue: '', pitfallToAvoid: '', priority, kind: 'lesson', ...extra }) as CarriedStep;
const shifted = (title: string, priority: number) => step(title, priority, { shiftedFrom: { taskId: 'tue', date: TUE, replaced: [] } });
const carried = (title: string, priority: number) => step(title, priority, { carriedFrom: { taskId: 'tue', date: TUE, replaced: [] } });
const dayOf = (taskId: string, date: string, dayNumber: number, kind: DayClassification['kind']): DayClassification => ({
  taskId, date, weekNumber: 1, dayNumber, isKeySession: false, isTestDay: false, kind,
});
const DAYS = [dayOf('tue', TUE, 2, 'done'), dayOf('wed', WED, 3, 'planned'), dayOf('fri', FRI, 5, 'planned')];
const AT_FRI = { taskId: 'fri', date: FRI };

describe('B-55: isDoneCopy', () => {
  it('a session gives its in-order step up, then is done with its other steps: the later copy is not ignored', () => {
    // Tuesday gave Lesson 2 up (it moved on to Friday, `shiftedFrom` naming Tuesday) and was done with its review.
    const tasks = [
      { id: 'tue', steps: [step('Review', 1, { kind: 'review' })] },
      { id: 'fri', steps: [shifted('Lesson 2', 1), step('Fri notes', 2)] },
    ];
    const done = doneStepsOf(DAYS, tasks);
    expect(isDoneCopy(tasks[1].steps[0], AT_FRI, done)).toBe(false);
    // The swap check: a day holding a reorder's copy is still never swapped.
    expect(markerRefusal([tasks[1].steps])).toBe('holds_carry');
  });

  it('B-50: set aside (the copy moves on), then the day is done anyway, still holding the step: the copy is ignored', () => {
    const tasks = [
      { id: 'tue', steps: [step('Lesson 1', 1), step('Review', 2, { kind: 'review' })] },
      { id: 'wed', steps: [shifted('Lesson 1', 1)] },
    ];
    expect(isDoneCopy(tasks[1].steps[0], { taskId: 'wed', date: WED }, doneStepsOf(DAYS, tasks))).toBe(true);
  });

  it('B-52: a moved step is ignored only when its done source day still holds it', () => {
    const moved = carried('Tempo run', 1);
    const holds = doneStepsOf(DAYS, [{ id: 'tue', steps: [step('Tempo run', 1)] }]);
    const gaveUp = doneStepsOf(DAYS, [{ id: 'tue', steps: [step('Easy run', 1)] }]);
    expect(isDoneCopy(moved, AT_FRI, holds)).toBe(true);
    expect(isDoneCopy(moved, AT_FRI, gaveUp)).toBe(false);
    // The source day open: never ignored, even holding the step.
    const open = doneStepsOf(DAYS.map((d) => (d.taskId === 'tue' ? { ...d, kind: 'planned' as const } : d)), [{ id: 'tue', steps: [step('Tempo run', 1)] }]);
    expect(isDoneCopy(moved, AT_FRI, open)).toBe(false);
  });

  it('matches by the day the step was written on: a copy written on another day held by the done day counts', () => {
    // Monday's Lesson 3 sat on Tuesday as a copy (shiftedFrom Monday), Tuesday was set aside and the copy moved to Friday
    // still naming Monday; Tuesday was then done holding its copy.
    const fromMon = { shiftedFrom: { taskId: 'mon', date: '2026-09-21', replaced: [] } };
    const tasks = [{ id: 'tue', steps: [step('Lesson 3', 1, fromMon)] }];
    const copy = step('Lesson 3', 1, { ...fromMon, carriedFrom: { taskId: 'tue', date: TUE, replaced: [] } });
    expect(isDoneCopy(copy, AT_FRI, doneStepsOf(DAYS, tasks))).toBe(true);
    // Same title written on another day: a different step.
    expect(isDoneCopy(copy, AT_FRI, doneStepsOf(DAYS, [{ id: 'tue', steps: [step('Lesson 3', 1)] }]))).toBe(false);
  });
});

describe('B-55: the stored carry signal', () => {
  const NOW = new Date('2026-09-23T10:00:00Z');
  const signalsOf = (tueSteps: CarriedStep[]) =>
    buildSignals({
      days: DAYS,
      doneSteps: doneStepsOf(DAYS, [{ id: 'tue', steps: tueSteps }]),
      gap: null,
      plan: { carries: [], drops: [], held: [], alreadyCarried: [{ fromTaskId: 'tue', fromDate: TUE, toTaskId: 'fri', toDate: FRI, step: carried('Tempo run', 1) }] },
      written: [],
      now: NOW,
      today: WED,
      timezone: 'UTC',
      sleepTime: '23:00',
    });

  it('names the receiving day when the done source day no longer holds the step, and not when it does', () => {
    expect(signalsOf([step('Easy run', 1)]).carried).toMatchObject([{ fromTaskId: 'tue', toTaskId: 'fri' }]);
    expect(signalsOf([step('Tempo run', 1)]).carried).toEqual([]);
  });
});
