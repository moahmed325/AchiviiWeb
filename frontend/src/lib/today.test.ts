import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal, MissedSignals, Reconciliation } from '../types';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  findNextTask,
  findYesterdayTask,
  isToday,
  isWeekReviewDue,
  isClosingStretchActive,
  minimumMinutes,
  missNotice,
  shortOnTimeOffer,
  parseIntention,
  parseSteps,
  parseTaskNotes,
  selectTodayTask,
  serializeTaskNotes,
  todayKey,
  weekdayOf,
  weekProgress,
} from './today';

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

const week = [
  task({ id: 'mon', dayNumber: 1, date: '2026-09-21', status: 'completed' }),
  task({ id: 'tue', dayNumber: 2, date: '2026-09-22', status: 'completed' }),
  task({ id: 'wed', dayNumber: 3, date: '2026-09-23' }),
  task({ id: 'thu', dayNumber: 4, date: '2026-09-24' }),
  task({ id: 'sun', dayNumber: 7, date: '2026-09-27', isRestDay: true }),
];

describe('currentWeekTasks', () => {
  it('keeps the current week only, in day order', () => {
    const goal = {
      currentWeek: 2,
      dailyTasks: [task({ id: 'b', weekNumber: 2, dayNumber: 9 }), task({ id: 'x', weekNumber: 1 }), task({ id: 'a', weekNumber: 2, dayNumber: 8 })],
    } as Goal;
    expect(currentWeekTasks(goal).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('treats a missing week as week 1 and missing tasks as none', () => {
    expect(currentWeekTasks({ currentWeek: 0, dailyTasks: [task({ id: 'x' })] } as Goal).map((t) => t.id)).toEqual(['x']);
    expect(currentWeekTasks({ currentWeek: 1 } as Goal)).toEqual([]);
  });
});

describe('selectTodayTask', () => {
  const wednesdayNoon = new Date('2026-09-23T12:00:00Z');

  it('prefers the chosen task, then today, then the first pending, then the first', () => {
    expect(selectTodayTask(week, wednesdayNoon, 'thu', 'UTC')?.id).toBe('thu');
    expect(selectTodayTask(week, wednesdayNoon, 'gone', 'UTC')?.id).toBe('wed');
    expect(selectTodayTask(week, wednesdayNoon, undefined, 'UTC')?.id).toBe('wed');
    expect(selectTodayTask(week, new Date('2026-10-30T12:00:00Z'), undefined, 'UTC')?.id).toBe('wed');
    const allDone = week.map((t) => ({ ...t, status: 'completed' as const }));
    expect(selectTodayTask(allDone, new Date('2026-10-30T12:00:00Z'), undefined, 'UTC')?.id).toBe('mon');
    expect(selectTodayTask([], wednesdayNoon)).toBeNull();
  });

  // ND-1 (missed-sessions M1.1b): task dates are the user's local calendar dates, so the user's timezone decides.
  it('uses the local date in UTC+3 just after local midnight, not the UTC date', () => {
    // 00:30 on Thursday in Addis Ababa is still Wednesday 21:30 UTC.
    const halfPastMidnightAddis = new Date('2026-09-23T21:30:00Z');
    expect(todayKey(halfPastMidnightAddis, 'Africa/Addis_Ababa')).toBe('2026-09-24');
    expect(selectTodayTask(week, halfPastMidnightAddis, undefined, 'Africa/Addis_Ababa')?.id).toBe('thu');
    expect(isToday(week[3], halfPastMidnightAddis, 'Africa/Addis_Ababa')).toBe(true);
  });

  it('uses the local date in a western timezone late in the evening, not the UTC date', () => {
    // 23:30 on Wednesday in New York (EDT) is already Thursday 03:30 UTC.
    const lateEveningNewYork = new Date('2026-09-24T03:30:00Z');
    expect(todayKey(lateEveningNewYork, 'America/New_York')).toBe('2026-09-23');
    expect(selectTodayTask(week, lateEveningNewYork, undefined, 'America/New_York')?.id).toBe('wed');
    // 23:30 on Wednesday in Los Angeles (UTC-7 in September).
    expect(todayKey(new Date('2026-09-24T06:30:00Z'), 'America/Los_Angeles')).toBe('2026-09-23');
  });

  it('handles UTC+14 (Pacific/Kiritimati), a day ahead of UTC for most of the day', () => {
    // 02:00 on Thursday in Kiritimati is 12:00 on Wednesday UTC.
    expect(todayKey(new Date('2026-09-23T12:00:00Z'), 'Pacific/Kiritimati')).toBe('2026-09-24');
  });

  it('turns over at local midnight across a DST change', () => {
    // New York leaves DST on 1 Nov 2026: 23:59 EST on 1 Nov is 04:59 UTC on 2 Nov; 00:00 EST on 2 Nov is 05:00 UTC.
    expect(todayKey(new Date('2026-11-02T04:59:00Z'), 'America/New_York')).toBe('2026-11-01');
    expect(todayKey(new Date('2026-11-02T05:00:00Z'), 'America/New_York')).toBe('2026-11-02');
  });

  it('falls back to the browser timezone when no timezone is stored, and never throws on a bad one', () => {
    const instant = new Date('2026-09-23T21:30:00Z');
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const expected = new Intl.DateTimeFormat('en-CA', { timeZone: browser, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
    expect(todayKey(instant)).toBe(expected);
    expect(todayKey(instant, undefined)).toBe(expected);
    expect(todayKey(instant, '')).toBe(expected);
    expect(() => todayKey(instant, 'Not/AZone')).not.toThrow();
    expect(todayKey(instant, 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('yesterday and review-due use the local day boundary', () => {
  it('finds yesterday by the user\'s local date', () => {
    // 00:30 Thursday in Addis Ababa: yesterday is Wednesday, although the UTC date is still Wednesday.
    const halfPastMidnightAddis = new Date('2026-09-23T21:30:00Z');
    expect(findYesterdayTask(week, halfPastMidnightAddis, 'Africa/Addis_Ababa')?.id).toBe('wed');
    expect(findYesterdayTask(week, halfPastMidnightAddis, 'UTC')?.id).toBe('tue');
  });

  it('makes the review due only after the last task date has passed locally', () => {
    const lastDay = week[week.length - 1].date;
    const pending = week.map((t) => ({ ...t, status: 'pending' as const }));
    // 23:30 on the last day in New York is the next UTC day, but the week is not over locally.
    const lateLastEvening = new Date(`${lastDay}T23:30:00-04:00`);
    expect(isWeekReviewDue(pending, lateLastEvening, 'America/New_York')).toBe(false);
    expect(isWeekReviewDue(pending, lateLastEvening, 'UTC')).toBe(true);
  });
});

describe('dayNumber', () => {
  const goal = { targetDate: '2026-12-22T00:00:00.000Z' } as Goal;

  it('counts down from 90 to the target date and clamps to 1–90', () => {
    expect(dayNumber(goal, new Date('2026-06-01T00:00:00Z'), 'UTC')).toBe(1); // before the start
    expect(dayNumber(goal, new Date('2026-09-23T00:00:00Z'), 'UTC')).toBe(1); // 90 days out
    expect(dayNumber(goal, new Date('2026-09-25T00:00:00Z'), 'UTC')).toBe(3);
    expect(dayNumber(goal, new Date('2026-12-21T00:00:00Z'), 'UTC')).toBe(90); // the last day
    expect(dayNumber(goal, new Date('2027-02-01T00:00:00Z'), 'UTC')).toBe(90); // after the target date
  });
});

describe('parseSteps and parseIntention', () => {
  it('returns no steps for missing, broken or non-list JSON', () => {
    expect(parseSteps(undefined)).toEqual([]);
    expect(parseSteps('{not json')).toEqual([]);
    expect(parseSteps('{"stepNumber":1}')).toEqual([]);
    expect(parseSteps('[{"stepNumber":1,"title":"Warm up"}]')).toEqual([{ stepNumber: 1, title: 'Warm up' }]);
  });

  it('splits when, where and action, or keeps the raw text', () => {
    expect(parseIntention('When: 7am | Where: park | Action: run')).toEqual({ when: '7am', where: 'park', action: 'run' });
    expect(parseIntention('Run after work')).toEqual({ raw: 'Run after work' });
    expect(parseIntention('')).toBeNull();
  });
});

describe('currentRoadmapWeek and weekProgress', () => {
  it('finds the current roadmap week, else the first', () => {
    const weeks = [{ weekNumber: 1, phase: 'Base' }, { weekNumber: 2, phase: 'Build' }] as Goal['roadmapWeeks'];
    expect(currentRoadmapWeek({ currentWeek: 2, roadmapWeeks: weeks } as Goal)?.phase).toBe('Build');
    expect(currentRoadmapWeek({ currentWeek: 9, roadmapWeeks: weeks } as Goal)?.phase).toBe('Base');
    expect(currentRoadmapWeek({ currentWeek: 1 } as Goal)).toBeUndefined();
  });

  it('counts practice days only', () => {
    expect(weekProgress(week)).toEqual({ practiceDays: 4, practiceDone: 2 });
  });
});

describe('parseTaskNotes and serializeTaskNotes', () => {
  it('parses empty or whitespace notes cleanly', () => {
    expect(parseTaskNotes(undefined)).toEqual({ freeformNotes: '', focusWins: [] });
    expect(parseTaskNotes(null)).toEqual({ freeformNotes: '', focusWins: [] });
    expect(parseTaskNotes('   ')).toEqual({ freeformNotes: '', focusWins: [] });
  });

  it('parses freeform-only notes', () => {
    expect(parseTaskNotes('Felt strong on the intervals')).toEqual({
      freeformNotes: 'Felt strong on the intervals',
      focusWins: [],
    });
  });

  it('parses focus wins only', () => {
    const raw = '• Focus win: Hit 180 spm cadence\n• Focus win: Kept heart rate in Zone 2';
    expect(parseTaskNotes(raw)).toEqual({
      freeformNotes: '',
      focusWins: ['Hit 180 spm cadence', 'Kept heart rate in Zone 2'],
    });
  });

  it('separates freeform notes and multiple focus wins', () => {
    const raw = 'Legs were fatigued early on.\nTook water at 15 min.\n• Focus win: Pushed through the final set\n• Focus win: Breathing was calm';
    expect(parseTaskNotes(raw)).toEqual({
      freeformNotes: 'Legs were fatigued early on.\nTook water at 15 min.',
      focusWins: ['Pushed through the final set', 'Breathing was calm'],
    });
  });

  it('serializes freeform and focus wins preserving structure', () => {
    expect(serializeTaskNotes('Reps 4x10', ['Hit target tempo', 'Good form'])).toBe(
      'Reps 4x10\n• Focus win: Hit target tempo\n• Focus win: Good form',
    );
    expect(serializeTaskNotes('', ['Solo win'])).toBe('• Focus win: Solo win');
    expect(serializeTaskNotes('Only freeform', [])).toBe('Only freeform');
    expect(serializeTaskNotes('', [])).toBe('');
  });
});

describe('findNextTask', () => {
  it('finds the next chronological practice task in the week', () => {
    expect(findNextTask(week, 'mon')?.id).toBe('tue');
    expect(findNextTask(week, 'tue')?.id).toBe('wed');
    expect(findNextTask(week, 'wed')?.id).toBe('thu');
  });

  it('skips rest days and returns null if no further practice tasks remain', () => {
    // thu (day 4) is followed by sun (day 7, rest day). There are no further practice days.
    expect(findNextTask(week, 'thu')).toBeNull();
    // invalid id
    expect(findNextTask(week, 'nonexistent')).toBeNull();
  });
});

describe('findYesterdayTask', () => {
  // week: mon (completed, 2026-09-21), tue (completed, 2026-09-22), wed (pending, 2026-09-23), thu (pending, 2026-09-24)
  it('finds yesterday task based on UTC calendar date', () => {
    const wednesday = new Date('2026-09-23T12:00:00Z');
    expect(findYesterdayTask(week, wednesday, 'UTC')?.id).toBe('tue');

    const tuesday = new Date('2026-09-22T12:00:00Z');
    expect(findYesterdayTask(week, tuesday, 'UTC')?.id).toBe('mon');

    const monday = new Date('2026-09-21T12:00:00Z');
    // Sunday is 2026-09-27 in week, so 2026-09-20 is not in week
    expect(findYesterdayTask(week, monday, 'UTC')).toBeNull();
  });
});

describe('weekdayOf', () => {
  it('names the weekday of a date key, and nothing for a key it cannot read', () => {
    expect(weekdayOf('2026-09-21')).toBe('Monday');
    expect(weekdayOf('2026-09-27')).toBe('Sunday');
    expect(weekdayOf('')).toBeNull();
    expect(weekdayOf('21/09/2026')).toBeNull();
  });
});

describe('missNotice (missed sessions M3.1)', () => {
  // Wednesday 2026-09-23 at noon UTC; yesterday is Tuesday 2026-09-22.
  const wednesday = new Date('2026-09-23T12:00:00Z');
  const goal = { id: 'g', dailyTasks: week } as Goal;
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const body = (signals: Partial<MissedSignals>, goalId = 'g') =>
    ({ applies: true, goalId, signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
  const carried = (fromDate: string, toDate: string) => ({ fromDate, fromTaskId: 'a', toDate, toTaskId: 'b', stepTitle: 'Lead' });

  it('carried into today, from yesterday', () => {
    expect(missNotice(body({ notice: 'carried', carried: [carried('2026-09-22', '2026-09-23')] }), goal, wednesday, 'UTC')).toEqual({
      kind: 'carried',
      day: 'Yesterday',
      intoToday: true,
      toWeekday: 'Wednesday',
    });
  });

  it('carried to a later day, from an earlier weekday', () => {
    expect(missNotice(body({ notice: 'carried', carried: [carried('2026-09-21', '2026-09-24')] }), goal, wednesday, 'UTC')).toEqual({
      kind: 'carried',
      day: 'Monday',
      intoToday: false,
      toWeekday: 'Thursday',
    });
  });

  it('dropped, named "Yesterday" or by weekday; the reason is never part of it', () => {
    expect(missNotice(body({ notice: 'dropped', dropped: [{ date: '2026-09-22', taskId: 'tue', reason: 'high_load' }] }), goal, wednesday, 'UTC')).toEqual({
      kind: 'dropped',
      day: 'Yesterday',
    });
    expect(missNotice(body({ notice: 'dropped', dropped: [{ date: '2026-09-21', taskId: 'mon', reason: 'does_not_fit' }] }), goal, wednesday, 'UTC')).toEqual({
      kind: 'dropped',
      day: 'Monday',
    });
  });

  it('"Yesterday" follows the user timezone', () => {
    // 2026-09-23T22:30Z is already Thursday in Addis Ababa (UTC+3), so Wednesday is yesterday there.
    const late = new Date('2026-09-23T22:30:00Z');
    const signals = { notice: 'dropped' as const, dropped: [{ date: '2026-09-23', taskId: 'wed', reason: 'high_load' as const }] };
    expect(missNotice(body(signals), goal, late, 'Africa/Addis_Ababa')).toEqual({ kind: 'dropped', day: 'Yesterday' });
    expect(missNotice(body(signals), goal, late, 'UTC')).toEqual({ kind: 'dropped', day: 'Wednesday' });
  });

  it('says nothing for gentle_return, swap_offer, null, no body, or another goal', () => {
    const offer = { missedTaskId: 'tue', missedDate: '2026-09-22', receivingTaskId: 'wed', receivingDate: '2026-09-23', offerUntil: '' };
    expect(missNotice(body({ notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: '2026-09-19', lastDate: '2026-09-22' } }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'swap_offer', swapOffer: offer }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: null, carried: [carried('2026-09-22', '2026-09-23')] }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(null, goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'carried', carried: [carried('2026-09-22', '2026-09-23')] }, 'other-goal'), goal, wednesday, 'UTC')).toBeNull();
  });

  it('never speaks on a rest day (AC-5), and never without the data it names', () => {
    const sunday = new Date('2026-09-27T12:00:00Z');
    expect(missNotice(body({ notice: 'dropped', dropped: [{ date: '2026-09-24', taskId: 'thu', reason: 'high_load' }] }), goal, sunday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'carried', carried: [] }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'dropped', dropped: [] }), goal, wednesday, 'UTC')).toBeNull();
    expect(missNotice(body({ notice: 'dropped', dropped: [{ date: 'bad', taskId: 'x', reason: 'high_load' }] }), goal, wednesday, 'UTC')).toBeNull();
  });
});

describe('isWeekReviewDue', () => {
  it('returns true when all task dates in the current week have passed', () => {
    const pastTasks = [
      task({ id: 't1', date: '2026-09-21' }),
      task({ id: 't2', date: '2026-09-22' }),
      task({ id: 't3', date: '2026-09-23' }),
    ];
    const friday = new Date('2026-09-25T12:00:00Z');
    expect(isWeekReviewDue(pastTasks, friday)).toBe(true);
  });

  it('returns false when at least one task date is today or in the future and practice tasks are pending', () => {
    const currentTasks = [
      task({ id: 't1', date: '2026-09-21', status: 'completed' }),
      task({ id: 't2', date: '2026-09-23', status: 'pending' }),
      task({ id: 't3', date: '2026-09-24', status: 'pending' }),
    ];
    const wednesday = new Date('2026-09-23T12:00:00Z');
    expect(isWeekReviewDue(currentTasks, wednesday)).toBe(false);
  });

  it('returns true when all active practice tasks are completed even if task dates are in the future', () => {
    const currentTasks = [
      task({ id: 't1', date: '2026-09-21', status: 'completed' }),
      task({ id: 't2', date: '2026-09-23', status: 'completed' }),
      task({ id: 't3', date: '2026-09-24', status: 'completed' }),
      task({ id: 't4', date: '2026-09-25', isRestDay: true, status: 'pending' }),
    ];
    const wednesday = new Date('2026-09-23T12:00:00Z');
    expect(isWeekReviewDue(currentTasks, wednesday)).toBe(true);
  });

  it('returns false when there are no tasks', () => {
    expect(isWeekReviewDue([], new Date())).toBe(false);
  });
});

describe('isClosingStretchActive', () => {
  const baseGoal = {
    id: 'g1',
    status: 'active',
    targetDate: '2026-12-30',
    currentWeek: 12,
    dailyTasks: [],
    weeklyReviews: [],
  } as unknown as Goal;

  it('returns true when dayNumber is 85 or greater', () => {
    // targetDate 5 days from now -> dayNumber = 91 - 5 = 86
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const goal = { ...baseGoal, currentWeek: 11, targetDate };
    expect(isClosingStretchActive(goal, now)).toBe(true);
  });

  it('returns true when currentWeek is 12 and all week 12 active tasks are completed', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(); // day < 85
    const week12Tasks = [
      task({ id: 't1', weekNumber: 12, isRestDay: false, status: 'completed' }),
      task({ id: 't2', weekNumber: 12, isRestDay: false, status: 'completed' }),
      task({ id: 't3', weekNumber: 12, isRestDay: true, status: 'pending' }),
    ];
    const goal = { ...baseGoal, currentWeek: 12, targetDate, dailyTasks: week12Tasks };
    expect(isClosingStretchActive(goal, now)).toBe(true);
  });

  it('returns true when currentWeek is 12 and week 12 review has been completed', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(); // day < 85
    const goal = {
      ...baseGoal,
      currentWeek: 12,
      targetDate,
      weeklyReviews: [{ id: 'rev12', weekNumber: 12, reflection: 'Done' }],
    } as unknown as Goal;
    expect(isClosingStretchActive(goal, now)).toBe(true);
  });

  it('returns false when status is not active (e.g. completed)', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const goal = { ...baseGoal, status: 'completed' as const, targetDate };
    expect(isClosingStretchActive(goal, now)).toBe(false);
  });

  it('returns false when week 12 has pending practice tasks and day is under 85', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString(); // day ~ 76
    const week12Tasks = [
      task({ id: 't1', weekNumber: 12, isRestDay: false, status: 'completed' }),
      task({ id: 't2', weekNumber: 12, isRestDay: false, status: 'pending' }),
    ];
    const goal = { ...baseGoal, currentWeek: 12, targetDate, dailyTasks: week12Tasks };
    expect(isClosingStretchActive(goal, now)).toBe(false);
  });

  it('returns false when currentWeek is less than 12 and day is under 85', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    const targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // day ~ 61
    const goal = { ...baseGoal, currentWeek: 8, targetDate };
    expect(isClosingStretchActive(goal, now)).toBe(false);
  });
});


describe('gentle_return and short on time (missed sessions M3.2)', () => {
  // Wednesday 2026-09-23 at noon UTC: 'wed' is today.
  const wednesday = new Date('2026-09-23T12:00:00Z');
  const MINIMUM = { stepNumber: 1, title: 'Ten minutes', durationMinutes: 10, instructions: 'Start small.', focusCue: '', pitfallToAvoid: '' };
  const goalWith = (today: Partial<DailyTask> = {}) =>
    ({ id: 'g', dailyTasks: week.map((t) => (t.id === 'wed' ? { ...t, minimumVersion: MINIMUM, ...today } : t)) }) as Goal;
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const body = (signals: Partial<MissedSignals>, goalId = 'g') =>
    ({ applies: true, goalId, signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
  const GENTLE: Partial<MissedSignals> = { notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: '2026-09-19', lastDate: '2026-09-22' } };

  it('missNotice: gentle_return when today is open practice with a 10-minute version', () => {
    expect(missNotice(body(GENTLE), goalWith(), wednesday, 'UTC')).toEqual({ kind: 'gentle_return' });
  });

  it('missNotice: no gentle_return without a 10-minute version, on a rest day, or on a completed day', () => {
    expect(missNotice(body(GENTLE), goalWith({ minimumVersion: null }), wednesday, 'UTC')).toBeNull();
    expect(missNotice(body(GENTLE), goalWith({ isRestDay: true }), wednesday, 'UTC')).toBeNull();
    expect(missNotice(body(GENTLE), goalWith({ status: 'completed' }), wednesday, 'UTC')).toBeNull();
    expect(missNotice(body(GENTLE, 'other-goal'), goalWith(), wednesday, 'UTC')).toBeNull();
  });

  it('shortOnTimeOffer: true only with the signal, an open practice day with a 10-minute version, and no gentle return', () => {
    expect(shortOnTimeOffer(body({ shortOnTime: true }), goalWith(), wednesday, 'UTC')).toBe(true);
    expect(shortOnTimeOffer(body({ shortOnTime: false }), goalWith(), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(body({ shortOnTime: true, ...GENTLE }), goalWith(), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(body({ shortOnTime: true }), goalWith({ minimumVersion: null }), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(body({ shortOnTime: true }), goalWith({ status: 'completed' }), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(body({ shortOnTime: true }), goalWith({ isRestDay: true }), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(body({ shortOnTime: true }, 'other-goal'), goalWith(), wednesday, 'UTC')).toBe(false);
    expect(shortOnTimeOffer(null, goalWith(), wednesday, 'UTC')).toBe(false);
  });
});

describe('minimumMinutes', () => {
  it("is the 10-minute version's own minutes, 10 when it has none, and null without one", () => {
    const step = { stepNumber: 1, title: 'x', durationMinutes: 8, instructions: '', focusCue: '', pitfallToAvoid: '' };
    expect(minimumMinutes({ minimumVersion: step })).toBe(8);
    expect(minimumMinutes({ minimumVersion: { ...step, durationMinutes: 0 } })).toBe(10);
    expect(minimumMinutes({ minimumVersion: null })).toBeNull();
    expect(minimumMinutes(null)).toBeNull();
  });
});
