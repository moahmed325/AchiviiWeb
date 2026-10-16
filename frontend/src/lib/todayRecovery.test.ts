import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal, MissedSignals, Reconciliation } from '../types';
import { missNotice, moveNowOffered, todayActions } from './today';
import { EASY_START_LINE, MOVED_WARM_UP_LINE, continueLine, doneTaskIds, stepLines } from './stepLines';

// Method-aware recovery M3.3: the server's line (`signals.line`) and choices (`carry.choices`), read with the method
// switch on; with it off (no `line`, no `choices`) everything stays as missed sessions built it (today.test.ts).

const task = (overrides: Partial<DailyTask>): DailyTask =>
  ({
    id: 't',
    goalId: 'g',
    weekNumber: 1,
    dayNumber: 1,
    date: '2026-09-21',
    dayOfWeek: 'Monday',
    title: 'Session',
    detailedSteps: '[]',
    implementationIntention: '',
    durationMinutes: 30,
    isRestDay: false,
    status: 'pending',
    created_at: '2026-09-21',
    ...overrides,
  }) as DailyTask;

// Wednesday 2026-09-23 at noon UTC; yesterday is Tuesday.
const wednesday = new Date('2026-09-23T12:00:00Z');
const days = [
  task({ id: 'mon', dayNumber: 1, date: '2026-09-21', status: 'completed' }),
  task({ id: 'tue', dayNumber: 2, date: '2026-09-22' }),
  task({ id: 'wed', dayNumber: 3, date: '2026-09-23', title: 'Tempo' }),
  task({ id: 'thu', dayNumber: 4, date: '2026-09-24', title: 'Hills' }),
  task({ id: 'fri', dayNumber: 5, date: '2026-09-25', title: 'Long run' }),
  task({ id: 'sat', dayNumber: 6, date: '2026-09-26', title: 'Test', isTestDay: true }),
  task({ id: 'sun', dayNumber: 7, date: '2026-09-27', isRestDay: true }),
];
const goal = { id: 'g', currentWeek: 1, dailyTasks: days } as Goal;
const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null, line: null };
const CARRY = { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] };
const body = (signals: Partial<MissedSignals>, carry: Record<string, unknown> = {}) =>
  ({ applies: true, goalId: 'g', days: [], carry: { ...CARRY, outcomes: [], ...carry }, signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
const line = (kind: string, date: string, toDate: string | null = null): Partial<MissedSignals> => ({
  notice: kind === 'carried' || kind === 'dropped' ? (kind as 'carried' | 'dropped') : 'method',
  line: { kind: kind as never, taskId: 'x', date, toTaskId: toDate ? 'y' : null, toDate },
});

describe('missNotice with the server\'s line (M3.3)', () => {
  it('a method outcome: the day, what happened, and the receiving day', () => {
    expect(missNotice(body(line('continued', '2026-09-22', '2026-09-25')), goal, wednesday, 'UTC')).toEqual({
      kind: 'recovery', day: 'Yesterday', outcome: 'continued', intoToday: false, toWeekday: 'Friday',
    });
    expect(missNotice(body(line('moved_in_order', '2026-09-21', '2026-09-23')), goal, wednesday, 'UTC')).toEqual({
      kind: 'recovery', day: 'Monday', outcome: 'moved_in_order', intoToday: true, toWeekday: 'Wednesday',
    });
    for (const outcome of ['let_go', 'fixed', 'no_room', 'next_week', 'left_out']) {
      expect(missNotice(body(line(outcome, '2026-09-22')), goal, wednesday, 'UTC')).toEqual({ kind: 'recovery', day: 'Yesterday', outcome, intoToday: false, toWeekday: null });
    }
  });

  it('set aside today: no {Day}, for every outcome; only with the carry switch on', () => {
    expect(missNotice(body(line('next_week', '2026-09-23')), goal, wednesday, 'UTC')).toEqual({ kind: 'recovery', day: null, outcome: 'next_week', intoToday: false, toWeekday: null });
    expect(missNotice(body(line('moved', '2026-09-23', '2026-09-24')), goal, wednesday, 'UTC')).toMatchObject({ day: null, outcome: 'moved', toWeekday: 'Thursday' });
    expect(missNotice(body(line('let_go', '2026-09-23'), { enabled: false }), goal, wednesday, 'UTC')).toBeNull();
  });

  it("a day under missed sessions' rules keeps the old kinds, set aside included", () => {
    expect(missNotice(body(line('carried', '2026-09-22', '2026-09-23')), goal, wednesday, 'UTC')).toEqual({ kind: 'carried', day: 'Yesterday', intoToday: true, toWeekday: 'Wednesday' });
    expect(missNotice(body(line('dropped', '2026-09-21')), goal, wednesday, 'UTC')).toEqual({ kind: 'dropped', day: 'Monday' });
    expect(missNotice(body(line('carried', '2026-09-23', '2026-09-24')), goal, wednesday, 'UTC')).toEqual({ kind: 'set_aside', movedTo: 'Thursday' });
    expect(missNotice(body(line('dropped', '2026-09-23')), goal, wednesday, 'UTC')).toEqual({ kind: 'set_aside', movedTo: null });
  });

  it('only the server\'s line: the old fields are not read once `line` is present', () => {
    // A carry from today in `carried` used to read as set aside; with the line present it is not looked at.
    const carried = [{ fromDate: '2026-09-23', fromTaskId: 'wed', toDate: '2026-09-24', toTaskId: 'thu', stepTitle: 'Lead' }];
    expect(missNotice(body({ notice: null, carried, line: null }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'method', line: null }), goal, wednesday, 'UTC')).toBeNull();
  });

  it('the swap offer and the gentle return still come first; a rest day and a line naming no readable day give null', () => {
    const offer = { missedTaskId: 'tue', missedDate: '2026-09-22', receivingTaskId: 'wed', receivingDate: '2026-09-23', offerUntil: '' };
    expect(missNotice(body({ notice: 'swap_offer', swapOffer: offer, line: null }), goal, wednesday, 'UTC')).toMatchObject({ kind: 'swap_offer' });
    expect(missNotice(body(line('let_go', '2026-09-26')), goal, new Date('2026-09-27T12:00:00Z'), 'UTC')).toBeNull();
    expect(missNotice(body(line('moved', '2026-09-22', 'bad')), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body(line('moved', '2026-09-22', null)), goal, wednesday, 'UTC')).toBeNull();
  });
});

describe('todayActions and moveNowOffered with the server\'s choices (RULE-16, M3.3)', () => {
  const ids = (list: DailyTask[]) => list.map((t) => t.id);
  const choices = (today: unknown, held: unknown[] = []) => body({}, { choices: { today, held } });

  it('reads only the choices: set aside as sent, swap only with a day, listing exactly those days', () => {
    expect(todayActions(choices({ taskId: 'wed', setAside: true, swapWith: ['fri'] }), goal, wednesday, 'UTC')).toMatchObject({ canSetAside: true, canSwap: true });
    expect(ids(todayActions(choices({ taskId: 'wed', setAside: true, swapWith: ['fri'] }), goal, wednesday, 'UTC')!.swapWith)).toEqual(['fri']);
    expect(todayActions(choices({ taskId: 'wed', setAside: true, swapWith: [] }), goal, wednesday, 'UTC')).toMatchObject({ canSetAside: true, canSwap: false, swapWith: [] });
    expect(todayActions(choices({ taskId: 'wed', setAside: false, swapWith: [] }), goal, wednesday, 'UTC')).toMatchObject({ canSetAside: false, canSwap: false });
  });

  it('nothing when the server offers nothing for today, or names another day as today; unknown swap days are left out', () => {
    expect(todayActions(choices(null), goal, wednesday, 'UTC')).toBeNull();
    expect(todayActions(choices({ taskId: 'tue', setAside: true, swapWith: ['thu'] }), goal, wednesday, 'UTC')).toBeNull();
    expect(ids(todayActions(choices({ taskId: 'wed', setAside: true, swapWith: ['elsewhere', 'thu'] }), goal, wednesday, 'UTC')!.swapWith)).toEqual(['thu']);
  });

  it('without choices (method switch off) the browser works it out as before', () => {
    expect(ids(todayActions(body({}), goal, wednesday, 'UTC')!.swapWith)).toEqual(['thu', 'fri']);
  });

  it('"move now" only when the held day\'s step would move; always without choices', () => {
    expect(moveNowOffered(choices(null, [{ taskId: 'tue', receivingTaskId: 'wed', moveNowTaskId: 'thu' }]), 'tue')).toBe(true);
    expect(moveNowOffered(choices(null, [{ taskId: 'tue', receivingTaskId: 'wed', moveNowTaskId: null }]), 'tue')).toBe(false);
    expect(moveNowOffered(choices(null, []), 'tue')).toBe(false);
    expect(moveNowOffered(body({}), 'tue')).toBe(true);
    expect(moveNowOffered(null, 'tue')).toBe(true);
  });
});

describe('stepLines (RULE-10, RULE-21, MR-26)', () => {
  it('the continue line from the marker\'s date', () => {
    expect(continueLine({ continueFrom: { date: '2026-09-22' } })).toBe('Pick up where Tuesday stopped.');
    expect(continueLine({ continueFrom: { date: 'bad' } })).toBeNull();
    expect(continueLine({})).toBeNull();
  });

  it('B-50: no continue line when the day the marker names is done; the line while it is open', () => {
    const marked = { instructions: 'Write on.', continueFrom: { taskId: 'tue', date: '2026-09-22' } };
    const done = doneTaskIds([{ id: 'tue', status: 'completed' }, { id: 'wed', status: 'pending' }]);
    expect([...done]).toEqual(['tue']);
    expect(continueLine(marked, done)).toBeNull();
    expect(stepLines(marked, done)).toEqual({ lead: [], body: 'Write on.' });
    expect(continueLine(marked, doneTaskIds([{ id: 'tue', status: 'pending' }]))).toBe('Pick up where Tuesday stopped.');
    expect(stepLines(marked)).toEqual({ lead: ['Pick up where Tuesday stopped.'], body: 'Write on.' });
    expect(doneTaskIds(undefined).size).toBe(0);
  });

  it('the easy and warm-up lines, alone or stacked, come off the top; nothing else changes', () => {
    expect(stepLines({ instructions: `${EASY_START_LINE}\n${MOVED_WARM_UP_LINE}\nRun 5 km.\nThen stretch.` })).toEqual({
      lead: [EASY_START_LINE, MOVED_WARM_UP_LINE],
      body: 'Run 5 km.\nThen stretch.',
    });
    expect(stepLines({ instructions: `${MOVED_WARM_UP_LINE}\nRun.` })).toEqual({ lead: [MOVED_WARM_UP_LINE], body: 'Run.' });
    expect(stepLines({ instructions: EASY_START_LINE })).toEqual({ lead: [EASY_START_LINE], body: '' });
    expect(stepLines({ instructions: 'Run.', continueFrom: { taskId: 'a', date: '2026-09-21' } })).toEqual({ lead: ['Pick up where Monday stopped.'], body: 'Run.' });
    // Only an exact first line counts.
    expect(stepLines({ instructions: `${EASY_START_LINE} Then run.` })).toEqual({ lead: [], body: `${EASY_START_LINE} Then run.` });
    expect(stepLines({ instructions: 'Run 5 km.' })).toEqual({ lead: [], body: 'Run 5 km.' });
    expect(stepLines({})).toEqual({ lead: [], body: '' });
  });
});
