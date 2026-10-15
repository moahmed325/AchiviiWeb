import { describe, it, expect } from 'vitest';
import type { CarriedStep, CarryInput, CarryTask } from '../src/lib/carryForward.js';
import { buildWeekPrompt, weekLayout, type WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { findOpenGap, type DayClassification, type DayKind } from '../src/lib/missedSessions.js';
import { weekCounts } from '../src/lib/missedSignals.js';
import { EASY_START_LINE, MOVED_WARM_UP_LINE, planRecovery } from '../src/lib/recovery/carry.js';
import { handoffBrief, hasHandoff, placeHandoff, weekHandoff, type HandoffTask, type PlacedDay, type WeekHandoff } from '../src/lib/recovery/handoff.js';
import { inOrderQueue } from '../src/lib/recovery/inOrder.js';
import { actionOf, withFixedKinds, type RecoveryKind, type RecoveryProfile } from '../src/lib/recovery/profile.js';

// Method-aware recovery M3.1d (RULE-20, RULE-21, MR-32): next week continues from where the person is. What the
// finished week hands on, what the writer is told, how code places it in the new week, the final week, no double
// counting, the easy line on a hard test step, and generated handoffs over whole plans. Pure: writeNextWeek's wiring is
// in writeNextWeekHandoff.test.ts.

const kind = (id: string, overrides: Partial<RecoveryKind> = {}): RecoveryKind => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' '),
  description: `A ${id} step.`,
  action: 'move',
  hard: false,
  inOrder: false,
  ...overrides,
});

function profileWith(restGapDays: number, template: RecoveryProfile['template'] = 'general'): RecoveryProfile {
  return withFixedKinds({
    version: 1,
    template,
    kinds: [
      kind('practice'),
      kind('drafting', { action: 'continue' }),
      kind('review', { action: 'let_go' }),
      kind('lesson', { inOrder: true }),
      kind('heavy', { hard: true }),
      kind('strength', { hard: true, inOrder: true }),
      kind('general'),
    ],
    catchAll: 'general',
    restGapDays,
    returnRule: {
      breaks: [{ length: 'any', restart: 'last level' }],
      firstWeekBack: 'Ease back in.',
    },
  });
}
const PROFILE = profileWith(1);

const step = (title: string, priority: number, minutes: number, kindId?: string, extra: Partial<CarriedStep> = {}): CarriedStep => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...(kindId ? { kind: kindId } : {}),
  ...extra,
});

/** A practice day: its main step of `kindId` (priority 1, 15 minutes), a let-go review and a general extra. 30 minutes. */
const day = (title: string, kindId: string, extra: Partial<CarriedStep> = {}): CarriedStep[] => [
  step(title, 1, 15, kindId, extra),
  step(`${title} review`, 2, 10, 'review'),
  step(`${title} extra`, 3, 5, 'general'),
];
const lesson = (n: number) => day(`Lesson ${n}`, 'lesson');

const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Name = (typeof NAMES)[number];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Week 1 starts on Monday 2026-09-14. Thu and Sun rest; Sat is the test day. */
const dateOf = (week: number, index: number) => new Date(Date.parse('2026-09-14T00:00:00Z') + ((week - 1) * 7 + index) * 86_400_000).toISOString().slice(0, 10);
const testSteps = (week: number, extra: Partial<CarriedStep> = {}) => [
  step(`Weekly test: week ${week}`, 1, 20, 'weekly_test', extra),
  step('Compare', 2, 10, 'weekly_test'),
];

interface Spec {
  done?: boolean;
  steps?: CarriedStep[];
}

/** A stored week. Practice days hold practice steps unless given; `done` defaults to true. */
function storedWeek(week: number, spec: Partial<Record<Name, Spec>> = {}): HandoffTask[] {
  return NAMES.map((name, index) => {
    const s = spec[name] ?? {};
    const isRestDay = name === 'thu' || name === 'sun';
    const isTestDay = name === 'sat';
    const steps = s.steps ?? (isRestDay ? [] : isTestDay ? testSteps(week) : day(`w${week} ${name} practice`, 'practice'));
    return {
      id: `${week}-${name}`,
      date: dateOf(week, index),
      weekNumber: week,
      dayNumber: (week - 1) * 7 + index + 1,
      dayOfWeek: DAY_NAMES[index],
      status: isRestDay || s.done !== false ? 'completed' : 'pending',
      isRestDay,
      isKeySession: false,
      isTestDay,
      steps,
    };
  });
}

/** The week the call returned: the given practice days' steps, otherwise practice steps; minutes are the steps' sum. */
function writtenWeek(week: number, spec: Partial<Record<Name, CarriedStep[]>> = {}): Array<PlacedDay & { id: string }> {
  return NAMES.map((name, index) => {
    const isRestDay = name === 'thu' || name === 'sun';
    const isTestDay = name === 'sat';
    const steps = spec[name] ?? (isRestDay ? [] : isTestDay ? testSteps(week) : day(`w${week} ${name} new`, 'practice'));
    return {
      id: `${week}-${name}`,
      date: dateOf(week, index),
      isRestDay,
      isTestDay,
      durationMinutes: steps.reduce((sum, s) => sum + s.durationMinutes, 0),
      detailedSteps: steps,
    };
  });
}

const titles = (days: readonly PlacedDay[], name: Name) => days[NAMES.indexOf(name)].detailedSteps.map((s) => s.title);
const stepOf = (days: readonly PlacedDay[], name: Name, title: string) => days[NAMES.indexOf(name)].detailedSteps.find((s) => s.title === title) as CarriedStep;
const recordsIn = (days: readonly PlacedDay[]) =>
  days.flatMap((d) => (d.detailedSteps as CarriedStep[]).flatMap((s) => (s.toNextWeek ?? []).map((r) => r.step.title)));

/** Last week: Lessons 1 to 9 written Mon to Fri; Wed and Fri not done, so Lessons 4 to 9 are not done. Their other steps let go. */
const lessonsFourToNineNotDone = () =>
  storedWeek(1, {
    mon: {
      steps: [step('Lesson 1', 1, 10, 'lesson'), step('Lesson 2', 2, 10, 'lesson'), step('mon extra', 3, 10, 'general')],
    },
    tue: {
      steps: [step('Lesson 3', 1, 15, 'lesson'), step('tue review', 2, 15, 'review')],
    },
    wed: {
      done: false,
      steps: [step('Lesson 4', 1, 15, 'lesson'), step('Lesson 5', 2, 10, 'lesson'), step('wed review', 3, 5, 'review')],
    },
    fri: {
      done: false,
      steps: [step('Lesson 6', 1, 10, 'lesson'), step('Lesson 7', 2, 10, 'lesson'), step('Lesson 8', 3, 5, 'lesson'), step('Lesson 9', 4, 5, 'lesson')],
    },
  });

/** Stores the placed week as the database would hold it, with the given days done. */
function store(week: number, days: readonly PlacedDay[], done: readonly Name[] = []): HandoffTask[] {
  return days.map((d, index) => ({
    id: `${week}-${NAMES[index]}`,
    date: d.date,
    weekNumber: week,
    dayNumber: (week - 1) * 7 + index + 1,
    dayOfWeek: DAY_NAMES[index],
    status: d.isRestDay || done.includes(NAMES[index]) ? 'completed' : 'pending',
    isRestDay: d.isRestDay,
    isKeySession: false,
    isTestDay: d.isTestDay,
    steps: JSON.parse(JSON.stringify(d.detailedSteps)),
  }));
}

const lessonsCarried = (handoff: WeekHandoff, k = 'lesson') => handoff.carried.find((c) => c.kind === k)?.steps.map((s) => s.title) ?? [];

describe('what the finished week hands on (requirement 2)', () => {
  it('the in-order steps not done, in order, records included; nothing for a week without kinds (RULE-18)', () => {
    const handoff = weekHandoff({
      tasks: lessonsFourToNineNotDone(),
      profile: PROFILE,
    });
    expect(lessonsCarried(handoff)).toEqual(['Lesson 4', 'Lesson 5', 'Lesson 6', 'Lesson 7', 'Lesson 8', 'Lesson 9']);
    expect(handoff.carried[0].steps[0]).toMatchObject({
      taskId: '1-wed',
      date: '2026-09-16',
      title: 'Lesson 4',
    });
    expect(handoff.letGo).toEqual([]);

    const untagged = lessonsFourToNineNotDone().map((t) => ({
      ...t,
      steps: t.steps.map(({ kind: _k, ...rest }) => rest as CarriedStep),
    }));
    expect(weekHandoff({ tasks: untagged, profile: PROFILE })).toEqual({
      carried: [],
      letGo: [],
      unfinished: [],
      noRoom: [],
    });
    expect(hasHandoff(weekHandoff({ tasks: untagged, profile: PROFILE }))).toBe(false);
  });

  it('a phase change keeps a kind still in the profile; a kind gone is let go and counted (MR-32 (4))', () => {
    const tasks = lessonsFourToNineNotDone();
    // The kind kept: carried, whatever the phase.
    expect(lessonsCarried(weekHandoff({ tasks, profile: PROFILE, previous: PROFILE }))).toHaveLength(6);
    // The profile the next phase uses has no in-order lessons any more.
    const without = {
      ...PROFILE,
      kinds: PROFILE.kinds.filter((k) => k.id !== 'lesson'),
    };
    const gone = weekHandoff({ tasks, profile: without, previous: PROFILE });
    expect(gone.carried).toEqual([]);
    expect(gone.letGo.map((s) => [s.kind, s.title])).toEqual(['4', '5', '6', '7', '8', '9'].map((n) => ['lesson', `Lesson ${n}`]));
    // Lessons that no longer keep their order are let go too.
    const unordered = {
      ...PROFILE,
      kinds: PROFILE.kinds.map((k) => (k.id === 'lesson' ? { ...k, inOrder: false } : k)),
    };
    expect(weekHandoff({ tasks, profile: unordered, previous: PROFILE }).letGo).toHaveLength(6);
  });

  it('the unfinished continue work and the no-room moves of other kinds, outside a break', () => {
    const tasks = storedWeek(1, {
      mon: { steps: day('Draft chapter 1', 'drafting') },
      tue: { done: false, steps: day('Grammar drill', 'practice') },
      wed: { steps: day('Draft chapter 2', 'drafting') },
      fri: {
        done: false,
        steps: [step('Draft chapter 3', 1, 10, 'drafting'), step('Intervals', 2, 15, 'heavy'), step('fri extra', 3, 5, 'general')],
      },
    });
    const handoff = weekHandoff({ tasks, profile: PROFILE });
    expect(handoff.unfinished.map((u) => [u.kind, u.title, u.dayOfWeek])).toEqual([['drafting', 'Draft chapter 3', 'Friday']]);
    expect(handoff.noRoom.map((m) => [m.title, m.kind, m.dayOfWeek, m.hard])).toEqual([
      ['Grammar drill', 'practice', 'Tuesday', false],
      ['Intervals', 'heavy', 'Friday', true],
    ]);
  });

  it('a no-room list skips a carried day, a moved step, a day of a break and a week without kinds', () => {
    const carried = step('Grammar drill', 1, 15, 'practice', {
      carriedFrom: { taskId: '1-mon', date: '2026-09-14', replaced: [] },
    });
    const tasks = storedWeek(1, {
      mon: { done: false, steps: day('Mon drill', 'practice') },
      tue: {
        done: false,
        steps: [carried, step('tue review', 2, 15, 'review')],
      },
    });
    // Mon's drill was carried (to Tue): not no room. Tue's step already moved once (MR-28 (2)): not listed either.
    expect(weekHandoff({ tasks, profile: PROFILE }).noRoom).toEqual([]);
    // Mon to Wed not done is a break (ND-11): nothing was carried out of it, and nothing is listed.
    const gap = storedWeek(1, {
      mon: { done: false },
      tue: { done: false },
      wed: { done: false },
    });
    expect(weekHandoff({ tasks: gap, profile: PROFILE }).noRoom).toEqual([]);
    // Two days not done are not a break: both are listed.
    expect(
      weekHandoff({
        tasks: storedWeek(1, { mon: { done: false }, tue: { done: false } }),
        profile: PROFILE,
      }).noRoom
    ).toHaveLength(2);
  });

  it('a break across the week change (sick Friday to Tuesday): its days are not told as no-room moves (ND-11)', () => {
    // Week 1: Friday and the Saturday test not done. Week 2 (finished): Monday and Tuesday not done, then back.
    const weekBefore = storedWeek(1, { fri: { done: false }, sat: { done: false } });
    const tasks = storedWeek(2, { mon: { done: false, steps: day('Grammar drill', 'practice') }, tue: { done: false, steps: day('Verb drill', 'practice') } });
    // Seen alone, two days are not a break: both would be told.
    expect(weekHandoff({ tasks, profile: PROFILE }).noRoom.map((m) => m.title)).toEqual(['Grammar drill', 'Verb drill']);
    // With the week before, Friday to Tuesday is one break of four practice days: nothing is told or placed.
    expect(weekHandoff({ tasks, profile: PROFILE, weekBefore }).noRoom).toEqual([]);
    // A break that ended before the week change does not reach into it.
    const ended = storedWeek(1, { tue: { done: false }, wed: { done: false }, fri: { done: false } });
    expect(weekHandoff({ tasks, profile: PROFILE, weekBefore: ended }).noRoom).toHaveLength(2);
  });

  it('continue work picked up by a later session that was done is finished', () => {
    const tasks = storedWeek(1, {
      mon: { done: false, steps: day('Draft A', 'drafting') },
      wed: {
        steps: day('Draft B', 'drafting', {
          continueFrom: { taskId: '1-mon', date: '2026-09-14' },
        }),
      },
    });
    expect(weekHandoff({ tasks, profile: PROFILE }).unfinished).toEqual([]);
  });
});

describe('code places the carried steps (requirement 3, MR-32 (1), (2))', () => {
  const threeSessions = () =>
    writtenWeek(2, {
      mon: day('Lesson A', 'lesson'),
      tue: day('w2 tue practice', 'practice'),
      wed: day('Lesson B', 'lesson'),
      fri: day('Lesson C', 'lesson'),
    });

  it('lessons 4 to 9 not done, three lesson sessions: they hold 4, 5 and 6, and 7 to 9 wait as records', () => {
    const handoff = weekHandoff({
      tasks: lessonsFourToNineNotDone(),
      profile: PROFILE,
    });
    const result = placeHandoff({
      days: threeSessions(),
      handoff,
      profile: PROFILE,
      lastWeek: lessonsFourToNineNotDone(),
    });
    expect(result.placed).toEqual([
      { kind: 'lesson', title: 'Lesson 4', date: '2026-09-21' },
      { kind: 'lesson', title: 'Lesson 5', date: '2026-09-23' },
      { kind: 'lesson', title: 'Lesson 6', date: '2026-09-25' },
    ]);
    expect(titles(result.days, 'mon')).toEqual(['Lesson 4', 'Lesson A review', 'Lesson A extra']);
    expect(titles(result.days, 'wed')[0]).toBe('Lesson 5');
    expect(titles(result.days, 'fri')[0]).toBe('Lesson 6');
    // A placed step keeps its identity: the day it was written on, and what it replaced.
    const four = stepOf(result.days, 'mon', 'Lesson 4');
    expect(four.shiftedFrom).toMatchObject({
      taskId: '1-wed',
      date: '2026-09-16',
    });
    expect(four.shiftedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson A']);
    expect(four.priority).toBe(1);
    // A lesson is not physical: no warm-up line (MR-31).
    expect(four.instructions).toBe('Do Lesson 4.');
    // No day longer than written.
    for (const [i, d] of result.days.entries()) expect(d.durationMinutes).toBeLessThanOrEqual(threeSessions()[i].durationMinutes);
    // 7 to 9 wait, in order, on the new week's first lesson step.
    expect(result.waiting).toEqual(
      ['Lesson 7', 'Lesson 8', 'Lesson 9'].map((title) => ({
        kind: 'lesson',
        title,
        why: 'sessions_full',
      }))
    );
    expect(stepOf(result.days, 'mon', 'Lesson 4').toNextWeek!.map((r) => [r.taskId, r.step.title])).toEqual([
      ['1-fri', 'Lesson 7'],
      ['1-fri', 'Lesson 8'],
      ['1-fri', 'Lesson 9'],
    ]);
  });

  it("the next handoff carries 7 to 9 first, then the new week's steps not done", () => {
    const last = lessonsFourToNineNotDone();
    const placed = placeHandoff({
      days: threeSessions(),
      handoff: weekHandoff({ tasks: last, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: last,
    });
    // Week 2: everything done but Friday (Lesson 6).
    const week2 = store(2, placed.days, ['mon', 'tue', 'wed', 'sat']);
    const next = weekHandoff({ tasks: week2, profile: PROFILE });
    expect(lessonsCarried(next)).toEqual(['Lesson 6', 'Lesson 7', 'Lesson 8', 'Lesson 9']);
    // A step the writer added after them comes after them.
    const withNew = store(2, placed.days, ['mon', 'tue', 'wed', 'sat']).map((t) =>
      t.id === '2-tue' ? { ...t, status: 'pending', steps: day('Lesson 10', 'lesson') } : t
    );
    expect(lessonsCarried(weekHandoff({ tasks: withNew, profile: PROFILE }))).toEqual(['Lesson 6', 'Lesson 7', 'Lesson 8', 'Lesson 9', 'Lesson 10']);
  });

  it('a step too long for its session: that session gives its lesson up, and the step takes the next session', () => {
    const last = storedWeek(1, {
      fri: {
        done: false,
        steps: [step('Lesson 4', 1, 25, 'lesson'), step('fri review', 2, 5, 'review')],
      },
    });
    // Monday's lesson is 10 minutes and its other steps can't be trimmed (fixed, another in-order kind).
    const days = writtenWeek(2, {
      mon: [step('Lesson A', 1, 10, 'lesson'), step('Group call', 2, 10, 'fixed_time_session'), step('Strength A', 3, 10, 'strength')],
      wed: day('Lesson B', 'lesson'),
    });
    const result = placeHandoff({
      days,
      handoff: weekHandoff({ tasks: last, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: last,
    });
    expect(result.gaveUp).toEqual([{ kind: 'lesson', date: '2026-09-21', title: 'Lesson A' }]);
    expect(titles(result.days, 'mon')).toEqual(['Group call', 'Strength A']);
    expect(result.days[0].durationMinutes).toBe(20);
    expect(result.placed).toEqual([{ kind: 'lesson', title: 'Lesson 4', date: '2026-09-23' }]);
    // Lesson 4 is 25 minutes: Lesson B's extra and review make room, lowest priority first.
    expect(titles(result.days, 'wed')).toEqual(['Lesson 4']);
    expect(result.days[2].durationMinutes).toBe(25);
    expect(result.waiting).toEqual([]);
  });

  it('a step too long for every session waits; a session whose lesson is its only step is never emptied', () => {
    const last = storedWeek(1, {
      fri: {
        done: false,
        steps: [step('Lesson 4', 1, 25, 'lesson'), step('fri review', 2, 5, 'review')],
      },
    });
    const days = writtenWeek(2, {
      mon: [step('Lesson A', 1, 10, 'lesson')],
      wed: [step('Lesson B', 1, 10, 'lesson'), step('Group call', 2, 20, 'fixed_time_session')],
    });
    const result = placeHandoff({
      days,
      handoff: weekHandoff({ tasks: last, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: last,
    });
    expect(result.placed).toEqual([]);
    // Monday's lesson is its day's only step: it is kept, and Wednesday is tried (it gives its lesson up).
    expect(result.gaveUp).toEqual([{ kind: 'lesson', date: '2026-09-23', title: 'Lesson B' }]);
    expect(result.waiting).toEqual([{ kind: 'lesson', title: 'Lesson 4', why: 'only_step' }]);
    expect(titles(result.days, 'mon')).toEqual(['Lesson A']);
    expect(titles(result.days, 'wed')).toEqual(['Group call']);
    expect(stepOf(result.days, 'mon', 'Lesson A').toNextWeek!.map((r) => r.step.title)).toEqual(['Lesson 4']);
  });

  it("a session whose only step is too short is skipped, not the end: Tuesday keeps its step, Wednesday and Friday hold 4 and 5, and 6 waits", () => {
    const last = storedWeek(1, {
      wed: { done: false, steps: [step('Lesson 4', 1, 15, 'lesson'), step('Lesson 5', 2, 10, 'lesson'), step('wed review', 3, 5, 'review')] },
      fri: { done: false, steps: [step('Lesson 6', 1, 15, 'lesson'), step('fri review', 2, 15, 'review')] },
    });
    const days = writtenWeek(2, { tue: [step('Lesson A', 1, 10, 'lesson')], wed: day('Lesson B', 'lesson'), fri: day('Lesson C', 'lesson') });
    const result = placeHandoff({ days, handoff: weekHandoff({ tasks: last, profile: PROFILE }), profile: PROFILE, lastWeek: last });
    expect(titles(result.days, 'tue')).toEqual(['Lesson A']);
    expect(result.placed).toEqual([
      { kind: 'lesson', title: 'Lesson 4', date: '2026-09-23' },
      { kind: 'lesson', title: 'Lesson 5', date: '2026-09-25' },
    ]);
    expect(result.gaveUp).toEqual([]);
    expect(result.waiting).toEqual([{ kind: 'lesson', title: 'Lesson 6', why: 'only_step' }]);
    expect(recordsIn(result.days)).toEqual(['Lesson 6']);
  });

  it('no session of the kind: every carried step waits, on the first practice step', () => {
    const last = lessonsFourToNineNotDone();
    const result = placeHandoff({
      days: writtenWeek(2),
      handoff: weekHandoff({ tasks: last, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: last,
    });
    expect(result.placed).toEqual([]);
    expect(result.waiting.map((w) => [w.title, w.why])).toEqual(['4', '5', '6', '7', '8', '9'].map((n) => [`Lesson ${n}`, 'no_session']));
    expect(stepOf(result.days, 'mon', 'w2 mon new').toNextWeek!.map((r) => r.step.title)).toEqual(['4', '5', '6', '7', '8', '9'].map((n) => `Lesson ${n}`));
    // Nothing else changed.
    expect(result.days.map((d) => (d.detailedSteps as CarriedStep[]).map(({ toNextWeek: _t, ...s }) => s))).toEqual(writtenWeek(2).map((d) => d.detailedSteps));
    expect(
      lessonsCarried(
        weekHandoff({
          tasks: store(2, result.days, ['tue', 'wed', 'fri', 'sat']),
          profile: PROFILE,
        })
      )
    ).toEqual(['4', '5', '6', '7', '8', '9'].map((n) => `Lesson ${n}`));
  });

  it('never the test day or a rest day; a fixed or continue-marked step is never trimmed', () => {
    const last = storedWeek(1, {
      fri: {
        done: false,
        steps: [step('Lesson 4', 1, 25, 'lesson'), step('fri review', 2, 5, 'review')],
      },
    });
    const days = writtenWeek(2, {
      mon: [
        step('Lesson A', 1, 10, 'lesson'),
        step('Group call', 2, 10, 'fixed_time_session'),
        step('Draft', 3, 10, 'drafting', {
          continueFrom: { taskId: 'x', date: '2026-09-20' },
        }),
      ],
      sat: [step('Weekly test: week 2', 1, 20, 'weekly_test'), step('Lesson Z', 2, 10, 'lesson')],
    });
    const result = placeHandoff({
      days,
      handoff: weekHandoff({ tasks: last, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: last,
    });
    expect(result.placed).toEqual([]);
    expect(titles(result.days, 'sat')).toEqual(['Weekly test: week 2', 'Lesson Z']);
    expect(titles(result.days, 'mon')).toEqual(['Group call', 'Draft']);
  });

  it("a hard in-order step keeps the rest gap against last week's done days; in a hard step's place only its own day counts (MR-29 (5))", () => {
    const profile = profileWith(2);
    const last = storedWeek(1, {
      fri: { done: false, steps: day('Strength 4', 'strength') },
      sat: { steps: testSteps(1, { highLoad: true }) },
    });
    // Last week's test was hard and done two days before Monday; this week's only strength session is Wednesday's.
    const days = writtenWeek(2, { wed: day('Strength B', 'strength') });
    const handoff = weekHandoff({ tasks: last, profile });
    expect(lessonsCarried(handoff, 'strength')).toEqual(['Strength 4']);
    const result = placeHandoff({ days, handoff, profile, lastWeek: last });
    // Wednesday took Strength 4 in Strength B's place: only its own day is checked.
    expect(result.placed).toEqual([{ kind: 'strength', title: 'Strength 4', date: '2026-09-23' }]);
    // A hard step moved carries the warm-up line (MR-31).
    expect(stepOf(result.days, 'wed', 'Strength 4').instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo Strength 4.`);

    // A hard strength step onto a day with no hard step two days after last week's hard test: the session gives its
    // step up, and the step waits.
    const light = writtenWeek(2, {
      mon: [step('Strength light', 1, 15, 'strength'), step('mon extra', 2, 15, 'general')],
    });
    const soft = {
      ...profile,
      kinds: profile.kinds.map((k) => (k.id === 'strength' ? { ...k, hard: false } : k)),
    };
    const lastHard = storedWeek(1, {
      fri: {
        done: false,
        steps: day('Strength 4', 'strength', { highLoad: true }),
      },
      sat: { steps: testSteps(1, { highLoad: true }) },
    });
    const blocked = placeHandoff({
      days: light,
      handoff: weekHandoff({ tasks: lastHard, profile: soft }),
      profile: soft,
      lastWeek: lastHard,
    });
    expect(blocked.placed).toEqual([]);
    expect(blocked.gaveUp).toEqual([{ kind: 'strength', date: '2026-09-21', title: 'Strength light' }]);
    expect(blocked.waiting).toEqual([{ kind: 'strength', title: 'Strength 4', why: 'sessions_full' }]);
  });
});

describe('the day describes its step (M3.1d review fix 1)', () => {
  /** The writer's week, with day text that names its own lesson. */
  const withText = () =>
    writtenWeek(2, { mon: day('Lesson A', 'lesson'), wed: day('Lesson B', 'lesson') }).map((d, index) =>
      d.isRestDay || d.isTestDay
        ? d
        : {
            ...d,
            title: index === 0 ? 'Learn Lesson A' : `Day ${index + 1}`,
            implementationIntention: index === 0 ? 'At 19:30: Learn Lesson A.' : `At 19:30: Day ${index + 1}.`,
            whyToday: index === 0 ? 'Lesson A opens the week.' : 'Keeps you moving.',
            minimumVersion: { ...d.detailedSteps[0], stepNumber: 1, title: `Short version: ${d.detailedSteps[0].title}`, durationMinutes: 10 },
          }
    );

  it('a placed step at priority 1 gives the day its title, 10-minute version and intention; a "why today" naming the old step is cleared', () => {
    const last = lessonsFourToNineNotDone();
    const result = placeHandoff({ days: withText(), handoff: weekHandoff({ tasks: last, profile: PROFILE }), profile: PROFILE, lastWeek: last });
    const mon = result.days[0];
    expect(mon.title).toBe('Lesson 4');
    expect(mon.implementationIntention).toBe('At 19:30: Lesson 4.');
    expect(mon.whyToday).toBe('');
    expect(mon.minimumVersion).toEqual({ ...lesson(4)[0], stepNumber: 1, title: 'Short version: Lesson 4', durationMinutes: 10, priority: undefined });
    expect(mon.minimumVersion).not.toHaveProperty('shiftedFrom');
    expect(mon.minimumVersion!.kind).toBe('lesson');
    // Wednesday's "why today" does not name Lesson B, so it stays; its intention had no lesson title to replace.
    const wed = result.days[2];
    expect(wed).toMatchObject({ title: 'Lesson 5', whyToday: 'Keeps you moving.', implementationIntention: 'At 19:30: Lesson 5.' });
    // A day whose priority-1 step did not change keeps its text.
    expect(result.days[1]).toMatchObject({ title: 'Day 2', implementationIntention: 'At 19:30: Day 2.', whyToday: 'Keeps you moving.' });
  });

  it('a session that gives its step up describes the step that is now first', () => {
    const last = storedWeek(1, { fri: { done: false, steps: [step('Lesson 4', 1, 25, 'lesson'), step('fri review', 2, 5, 'review')] } });
    const days = withText().map((d, i) =>
      i === 0 ? { ...d, detailedSteps: [step('Lesson A', 1, 10, 'lesson'), step('Group call', 2, 10, 'fixed_time_session'), step('Strength A', 3, 10, 'strength')] } : d
    );
    const result = placeHandoff({ days, handoff: weekHandoff({ tasks: last, profile: PROFILE }), profile: PROFILE, lastWeek: last });
    expect(result.gaveUp.map((g) => g.title)).toEqual(['Lesson A']);
    expect(result.days[0]).toMatchObject({ title: 'Group call', implementationIntention: 'At 19:30: Group call.', whyToday: '' });
    expect(result.days[0].minimumVersion).toMatchObject({ title: 'Short version: Group call', kind: 'fixed_time_session', durationMinutes: 10 });
  });
});

describe('no-room moves of other kinds (requirement 5, MR-32 (3))', () => {
  const last = () =>
    storedWeek(1, {
      tue: { done: false, steps: day('Grammar drill', 'practice') },
      fri: {
        done: false,
        steps: [step('Intervals', 1, 15, 'heavy'), step('fri review', 2, 15, 'review')],
      },
    });

  it('a non-hard one takes the first session of its kind when it fits; a hard one is only told', () => {
    const handoff = weekHandoff({ tasks: last(), profile: PROFILE });
    const days = writtenWeek(2, { mon: day('Hills', 'heavy') });
    const result = placeHandoff({
      days,
      handoff,
      profile: PROFILE,
      lastWeek: last(),
    });
    expect(result.noRoomPlaced).toEqual([{ kind: 'practice', title: 'Grammar drill', date: '2026-09-22' }]);
    expect(titles(result.days, 'tue')[0]).toBe('Grammar drill');
    expect(stepOf(result.days, 'tue', 'Grammar drill').shiftedFrom).toMatchObject({ taskId: '1-tue', date: '2026-09-15' });
    // The hard one is never placed: Monday keeps its own hard step.
    expect(titles(result.days, 'mon')[0]).toBe('Hills');
    expect(result.days.flatMap((d) => d.detailedSteps.map((s) => s.title))).not.toContain('Intervals');
  });

  it('a non-hard one that does not fit is only told', () => {
    const big = storedWeek(1, {
      tue: { done: false, steps: [step('Grammar drill', 1, 30, 'practice')] },
    });
    const days = writtenWeek(2, {
      mon: [step('Drill A', 1, 10, 'practice'), step('Group call', 2, 20, 'fixed_time_session')],
    });
    const result = placeHandoff({
      days,
      handoff: weekHandoff({ tasks: big, profile: PROFILE }),
      profile: PROFILE,
      lastWeek: big,
    });
    expect(result.noRoomPlaced).toEqual([]);
    expect(titles(result.days, 'mon')).toEqual(['Drill A', 'Group call']);
  });
});

describe('what the writer is told (requirement 4)', () => {
  it('the steps code places, where the person is and how far behind, the unfinished work and the no-room moves', () => {
    // Mon and Tue not done, Wed done, Fri not done: no break of three days.
    const tasks = storedWeek(1, {
      mon: {
        done: false,
        steps: [step('Lesson 4', 1, 15, 'lesson'), step('Lesson 5', 2, 15, 'lesson')],
      },
      tue: { done: false, steps: day('Grammar drill', 'practice') },
      wed: { steps: day('Draft chapter 1', 'drafting') },
      fri: {
        done: false,
        steps: [step('Draft chapter 2', 1, 10, 'drafting'), step('Intervals', 2, 15, 'heavy'), step('fri extra', 3, 5, 'general')],
      },
    });
    const lines = handoffBrief(weekHandoff({ tasks, profile: PROFILE }));
    expect(lines).toEqual([
      '- Lesson (kind lesson): they have not done these steps yet, in this order: "Lesson 4", "Lesson 5". They are at "Lesson 4", 2 steps behind the plan. ' +
        "Code puts these steps, in this order, into this week's first steps of kind lesson, each in place of the step you write there, so give those sessions a step of this kind. " +
        'Write any further step of this kind to continue after "Lesson 5".',
      '- Drafting (kind drafting): the work of "Draft chapter 2" (Friday) is not finished. Pick it up in this week\'s first step of this kind.',
      '- "Grammar drill" (kind practice, Tuesday) found no room last week. Code puts it in place of this week\'s first step of kind practice when it fits.',
      '- "Intervals" (kind heavy, Friday) found no room last week. It is hard: do not add it on top of this week\'s hard sessions; take it into account when you set the week\'s load.',
    ]);
  });

  it('the block goes in the prompt only when there is something to say', () => {
    const base: WeekCallInput = {
      finalGoal: 'Speak Spanish',
      answers: [],
      dailyMinutes: 30,
      planVariant: 'steady',
      slotTime: '19:30',
      method: { name: 'Lessons', creator: '', rules: [] },
      weekNumber: 2,
      totalWeeks: 12,
      phase: { name: 'Base', purpose: 'Build.' },
      focus: 'Basics',
      target: {
        kind: 'number',
        metric: 'Words',
        value: 100,
        unit: 'words',
        direction: 'higher_is_better',
      } as never,
      test: {
        type: 'quiz',
        instructions: 'Take the quiz',
        passIf: '80%',
      } as never,
      weekStart: new Date('2026-09-21T00:00:00Z'),
      recovery: PROFILE,
    };
    const layout = weekLayout('steady', base.weekStart);
    const plain = buildWeekPrompt(base, layout);
    expect(buildWeekPrompt({ ...base, whereTheyAre: [] }, layout)).toBe(plain);
    const told = buildWeekPrompt({ ...base, whereTheyAre: ['- one', '- two'] }, layout);
    expect(told).toBe(`${plain}\n\nWHERE THEY ARE (from last week; code acts on this after you answer, nothing here is checked)\n- one\n- two`);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The reconcile side: the final week, no double counting, the easy line on a hard test step.

/** Two weeks of the reconcile planner's input, numbered `first` and `first + 1` (dates as weeks 1 and 2 above). */
function carryInput(first: number, spec: Partial<Record<`${1 | 2}-${Name}`, { kind?: DayKind; steps?: CarriedStep[] }>>, today: string): CarryInput {
  const tasks: CarryTask[] = [];
  const days: DayClassification[] = [];
  for (const week of [1, 2] as const) {
    NAMES.forEach((name, index) => {
      const s = spec[`${week}-${name}`] ?? {};
      const isRestDay = name === 'thu' || name === 'sun';
      const isTestDay = name === 'sat';
      const steps = s.steps ?? (isRestDay ? [] : isTestDay ? testSteps(week) : day(`${week}-${name} practice`, 'practice'));
      const date = dateOf(week, index);
      const dayKind: DayKind = isRestDay ? 'rest' : (s.kind ?? (date < today ? 'done' : 'planned'));
      const weekNumber = first + week - 1;
      tasks.push({
        id: `${week}-${name}`,
        date,
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + index + 1,
        status: dayKind === 'done' ? 'completed' : 'pending',
        isRestDay,
        isKeySession: false,
        isTestDay,
        durationMinutes: steps.reduce((sum, x) => sum + x.durationMinutes, 0),
        steps,
      });
      days.push({
        taskId: `${week}-${name}`,
        date,
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + index + 1,
        isKeySession: false,
        isTestDay,
        kind: dayKind,
      });
    });
  }
  return {
    days,
    gap: findOpenGap(days),
    tasks,
    goal: { rawGoal: 'Learn Spanish', clarifiedOutcome: 'Hold a conversation' },
    today,
    timezone: 'UTC',
    sleepTime: '23:00',
  };
}
const countable = (input: CarryInput) =>
  input.tasks.map((t) => ({
    id: t.id,
    weekNumber: t.weekNumber,
    isRestDay: t.isRestDay,
    isKeySession: t.isKeySession,
  }));

describe('the final week (requirement 6, MR-32 (6))', () => {
  const lastLessonMissed = (first: number) =>
    carryInput(
      first,
      {
        '2-tue': { steps: lesson(4) },
        '2-fri': { kind: 'missed', steps: lesson(5) },
      },
      '2026-09-27'
    );

  it('in week 12 the leftovers are left out: outcome left_out, nothing listed for next week, toNextWeek 0', () => {
    const input = lastLessonMissed(11);
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const reorder = plan.reorders!.find((r) => r.weekNumber === 12)!;
    expect(reorder.toNextWeek).toEqual([]);
    expect(reorder.leftOut!.map((s) => s.title)).toEqual(['Lesson 5']);
    expect(plan.outcomes!.find((o) => o.taskId === '2-fri')).toMatchObject({
      outcome: 'left_out',
      topStep: 'left_out',
    });
    expect(
      weekCounts(12, {
        tasks: countable(input),
        days: input.days,
        carry: plan,
      })
    ).toMatchObject({ toNextWeek: 0, noRoom: 0 });
  });

  it('in week 11 the same day is next_week, as before', () => {
    const input = lastLessonMissed(10);
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const reorder = plan.reorders!.find((r) => r.weekNumber === 11)!;
    expect(reorder.toNextWeek.map((s) => s.title)).toEqual(['Lesson 5']);
    expect(reorder).not.toHaveProperty('leftOut');
    expect(plan.outcomes!.find((o) => o.taskId === '2-fri')).toMatchObject({
      outcome: 'next_week',
      topStep: 'next_week',
    });
    expect(
      weekCounts(11, {
        tasks: countable(input),
        days: input.days,
        carry: plan,
      })
    ).toMatchObject({ toNextWeek: 1 });
  });
});

describe('a step handed on is no longer listed in last week (requirement 7, logic check finding 9)', () => {
  it("last week's queue ignores what next week holds; its day stays next_week and is not counted twice", () => {
    // Week 1: Lesson 4 (Wed) and Lesson 5 (Fri) not done. Week 2 (written at the review): Lesson 4 placed on Mon,
    // Lesson 5 waits as a record. Today is Tuesday of week 2.
    const four = {
      ...lesson(4)[0],
      shiftedFrom: { taskId: '1-wed', date: '2026-09-16', replaced: [] },
    };
    const record = { taskId: '1-fri', date: '2026-09-18', step: lesson(5)[0] };
    const input = carryInput(
      1,
      {
        '1-wed': { kind: 'missed', steps: lesson(4) },
        '1-fri': { kind: 'missed', steps: lesson(5) },
        '2-mon': {
          kind: 'done',
          steps: [{ ...four, toNextWeek: [record] }, ...lesson(0).slice(1)],
        },
      },
      '2026-09-22'
    );
    const queues = inOrderQueue({ ...input, profile: PROFILE });
    const week1 = queues.find((q) => q.weekNumber === 1)!;
    expect(week1.steps).toEqual([]);
    // Lesson 4 is done in week 2, so it is done (M3.1d review); Lesson 5 is handed on and listed there, once.
    expect(week1.handedOn).toHaveLength(1);
    expect(queues.find((q) => q.weekNumber === 2)!.steps.map((s) => [s.title, s.status])).toEqual([['Lesson 5', 'next_week']]);

    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    expect(plan.reorders!.find((r) => r.weekNumber === 1)).toBeUndefined();
    expect(plan.outcomes!.filter((o) => o.taskId.startsWith('1-')).map((o) => [o.taskId, o.outcome])).toEqual([
      ['1-wed', 'moved'],
      ['1-fri', 'next_week'],
    ]);
    expect(weekCounts(1, { tasks: countable(input), days: input.days, carry: plan }).toNextWeek).toBe(0);
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan }).toNextWeek).toBe(1);
  });

  it('a week handed on keeps its open sessions as they are (handed_on)', () => {
    // The review was sent early: Friday of week 1 is still open, and next week already holds its lesson.
    const record = { taskId: '1-fri', date: '2026-09-18', step: lesson(5)[0] };
    const input = carryInput(
      1,
      {
        '1-wed': { kind: 'missed', steps: lesson(4) },
        '1-fri': { kind: 'planned', steps: lesson(5) },
        '2-mon': {
          kind: 'planned',
          steps: [{ ...lesson(6)[0], toNextWeek: [record] }, ...lesson(6).slice(1)],
        },
      },
      '2026-09-18'
    );
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    // Lesson 4 (Wed, missed) was not handed on in this made-up week, so it is still listed; Friday keeps Lesson 5.
    const reorder = plan.reorders!.find((r) => r.weekNumber === 1)!;
    expect(reorder.waits).toBe('handed_on');
    expect(reorder.rows).toEqual([]);
    expect(reorder.sessions).toEqual([{ taskId: '1-fri', date: '2026-09-18', holds: { taskId: '1-fri', date: '2026-09-18', title: 'Lesson 5' }, changed: false }]);
    expect(reorder.toNextWeek.map((s) => s.title)).toEqual(['Lesson 4']);
  });
});

describe('a step done anywhere is done (M3.1d review fix 2)', () => {
  // The review was sent on Thursday of week 1: Friday's Lesson 9 was handed on to Monday of week 2. Then the person did
  // Friday after all. Today is Monday of week 2.
  const nine = { ...lesson(9)[0], shiftedFrom: { taskId: '1-fri', date: '2026-09-18', replaced: [], stepNumber: 1 } };
  const monday = (steps: CarriedStep[], wed?: CarriedStep[]) =>
    carryInput(1, { '1-fri': { kind: 'done', steps: lesson(9) }, '2-mon': { kind: 'planned', steps }, ...(wed ? { '2-wed': { kind: 'planned' as const, steps: wed } } : {}) }, '2026-09-21');

  it('Friday done: Monday no longer holds Lesson 9; it takes the next step not done', () => {
    const input = monday([nine, ...lesson(9).slice(1)], lesson(10));
    expect(inOrderQueue({ ...input, profile: PROFILE }).flatMap((q) => q.steps.map((s) => s.title))).toEqual(['Lesson 10']);
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const rows = plan.reorders!.flatMap((r) => r.rows);
    expect(rows.find((r) => r.taskId === '2-mon')!.steps[0].title).toBe('Lesson 10');
    // Wednesday had Lesson 10 and has nothing left to take: it gives its copy up (its other steps stay).
    expect(rows.find((r) => r.taskId === '2-wed')!.steps.map((s) => s.title)).toEqual(['Lesson 10 review', 'Lesson 10 extra']);
  });

  it('nothing left to take: the copy is given up, unless it is the day\'s only step', () => {
    const plan = planRecovery({ ...monday([nine, ...lesson(9).slice(1)]), method: { profile: PROFILE } });
    expect(plan.reorders!.flatMap((r) => r.rows).find((r) => r.taskId === '2-mon')!.steps.map((s) => s.title)).toEqual(['Lesson 9 review', 'Lesson 9 extra']);
    const only = planRecovery({ ...monday([nine]), method: { profile: PROFILE } });
    expect((only.reorders ?? []).flatMap((r) => r.rows).find((r) => r.taskId === '2-mon')).toBeUndefined();
  });
});

describe('a step waiting inside the new week is never lost when its record\'s step leaves the day (M3.1d)', () => {
  const record = { taskId: '1-fri', date: '2026-09-18', step: lesson(7)[0] };
  const waitingTitles = (steps: readonly CarriedStep[]) => steps.flatMap((s) => (s.toNextWeek ?? []).map((r) => r.step.title));

  it('a reorder that replaces the step holding the record moves the record onto the step it places', () => {
    // Week 2: Lesson 4 placed on Mon (missed); Tue holds Lesson 5 with Lesson 7 waiting on it. Today is Tuesday.
    const four = { ...lesson(4)[0], shiftedFrom: { taskId: '1-wed', date: '2026-09-16', replaced: [], stepNumber: 1 } };
    const five = { ...lesson(5)[0], shiftedFrom: { taskId: '1-thu', date: '2026-09-17', replaced: [], stepNumber: 1 }, toNextWeek: [record] };
    const input = carryInput(1, { '2-mon': { kind: 'missed', steps: [four, ...lesson(4).slice(1)] }, '2-tue': { steps: [five, ...lesson(5).slice(1)] } }, '2026-09-22');
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const tue = plan.reorders!.flatMap((r) => r.rows).find((r) => r.taskId === '2-tue')!;
    expect(tue.steps[0].title).toBe('Lesson 4');
    expect(waitingTitles(tue.steps)).toEqual(['Lesson 7']);
  });

  it('a session that gives its step up keeps the record on a step it keeps', () => {
    const five = { ...step('Lesson 5', 1, 10, 'lesson'), toNextWeek: [record] };
    const input = carryInput(
      1,
      {
        '2-mon': { kind: 'missed', steps: [step('Lesson 4', 1, 25, 'lesson'), step('mon review', 2, 5, 'review')] },
        '2-tue': { steps: [five, step('Group call', 2, 20, 'fixed_time_session')] },
      },
      '2026-09-22'
    );
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const tue = plan.reorders!.flatMap((r) => r.rows).find((r) => r.taskId === '2-tue')!;
    expect(tue.steps.map((s) => s.title)).toEqual(['Group call']);
    expect(waitingTitles(tue.steps)).toEqual(['Lesson 7']);
  });

  it('an ordinary carry that trims the step holding the record moves the record onto the carried step', () => {
    const extra = { ...step('tue extra', 3, 15, 'general'), toNextWeek: [record] };
    const input = carryInput(
      1,
      {
        '2-mon': { kind: 'missed', steps: [step('Grammar drill', 1, 15, 'practice'), step('mon review', 2, 15, 'review')] },
        '2-tue': { steps: [step('tue practice', 1, 10, 'practice'), step('tue review', 2, 5, 'review'), extra] },
      },
      '2026-09-22'
    );
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    const carry = plan.carries.find((c) => c.toTaskId === '2-tue')!;
    expect(carry.steps.map((s) => s.title)).not.toContain('tue extra');
    expect(waitingTitles(carry.steps)).toEqual(['Lesson 7']);
    expect(carry.step.toNextWeek!.map((r) => r.step.title)).toEqual(['Lesson 7']);
  });
});

describe('RULE-21 on a hard test step (requirement 8, MR-32 (5))', () => {
  it('the first day back is the test day and its test step is hard: the easy line goes on the test step, once', () => {
    const hardTest = [step('Weekly test: run 3 km', 1, 20, 'weekly_test', { highLoad: true }), step('Compare', 2, 10, 'weekly_test')];
    const input = carryInput(
      1,
      {
        '2-tue': { kind: 'missed' },
        '2-wed': { kind: 'missed' },
        '2-fri': { kind: 'missed' },
        '2-sat': { steps: hardTest },
      },
      '2026-09-26'
    );
    expect(input.gap).not.toBeNull();
    const plan = planRecovery({ ...input, method: { profile: PROFILE } });
    expect(plan.easyStart).toMatchObject({
      taskId: '2-sat',
      stepTitle: 'Weekly test: run 3 km',
      durationMinutes: 30,
    });
    expect(plan.easyStart!.steps.map((s) => s.instructions)).toEqual([`${EASY_START_LINE}\nDo Weekly test: run 3 km.`, 'Do Compare.']);
    // Once: not again after it is stored.
    const stored = {
      ...input,
      tasks: input.tasks.map((t) => (t.id === '2-sat' ? { ...t, steps: plan.easyStart!.steps } : t)),
    };
    expect(planRecovery({ ...stored, method: { profile: PROFILE } }).easyStart).toBeNull();
  });

  it('not on a test step that is not hard, and not when an open day comes before the test day', () => {
    const plain = carryInput(
      1,
      {
        '2-tue': { kind: 'missed' },
        '2-wed': { kind: 'missed' },
        '2-fri': { kind: 'missed' },
      },
      '2026-09-26'
    );
    expect(planRecovery({ ...plain, method: { profile: PROFILE } }).easyStart).toBeNull();
    const hardTest = [step('Weekly test: run 3 km', 1, 20, 'weekly_test', { highLoad: true }), step('Compare', 2, 10, 'weekly_test')];
    const before = carryInput(
      1,
      {
        '2-mon': { kind: 'missed' },
        '2-tue': { kind: 'missed' },
        '2-wed': { kind: 'missed' },
        '2-sat': { steps: hardTest },
      },
      '2026-09-25'
    );
    expect(planRecovery({ ...before, method: { profile: PROFILE } }).easyStart).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Generated handoffs (AC-14): whole plans, week after week.

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 400 plans of 12 weeks. Each week a writer writes the days, code places what last week hands on, and the person does
 * or skips each day (with breaks). `follows`: the writer gives each kind with carried steps up to two sessions, as the
 * prompt asks; otherwise it picks each day's main kind at random. Every check runs at every handoff.
 */
function simulate(seed: number, follows: boolean) {
  const random = seeded(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  let handoffs = 0;
  /** Handoffs where a kind had carried steps and the writer wrote no session of it. */
  let noSessionWeeks = 0;
  let placedTotal = 0;
  let waitingTotal = 0;
  let gaveUpTotal = 0;
  let noRoomPlacedTotal = 0;
  let waitingWithNoSession = 0;
  let longestWait = 0;
  let leftAtTheEnd = 0;

  for (let plan = 0; plan < 400; plan++) {
    const profile = profileWith(Math.floor(random() * 3), pick(['general', 'strength'] as const));
    const sequenceKinds = ['lesson', 'strength'];
    let previous: HandoffTask[] | null = null;
    /** How many handoffs in a row each waiting step has waited. */
    const waits = new Map<string, number>();
    let counter = 0;

    for (let week = 1; week <= 12; week++) {
      // The writer: each practice day holds a step of a random kind (sometimes a lesson or a strength session),
      // with 1 to 3 other steps. Minutes vary, so some carried steps do not fit.
      const spec: Partial<Record<Name, CarriedStep[]>> = {};
      const told = previous ? weekHandoff({ tasks: previous, profile }) : null;
      const asked = follows && told ? told.carried.flatMap((c) => Array.from({ length: Math.min(2, c.steps.length) }, () => c.kind)) : [];
      for (const name of ['mon', 'tue', 'wed', 'fri'] as const) {
        const main = asked.shift() ?? (random() < 0.55 ? pick(sequenceKinds) : pick(['practice', 'heavy', 'drafting', 'general']));
        counter += 1;
        const steps = [step(`w${week} ${main} #${counter}`, 1, 5 + Math.floor(random() * 4) * 5, main, random() < 0.1 ? { highLoad: true } : {})];
        const extras = 1 + Math.floor(random() * 3);
        for (let i = 0; i < extras; i++)
          steps.push(
            step(`w${week} ${name} extra ${i}`, i + 2, 5 + Math.floor(random() * 3) * 5, pick(['review', 'general', 'practice', 'fixed_time_session']))
          );
        spec[name] = steps;
      }
      if (random() < 0.3) spec.sat = testSteps(week, { highLoad: true });
      let days = writtenWeek(week, spec);
      const written = days;

      if (previous) {
        const handoff = weekHandoff({ tasks: previous, profile });
        handoffs += 1;
        expect(handoff.letGo).toEqual([]);
        const result = placeHandoff({
          days,
          handoff,
          profile,
          lastWeek: previous,
        });
        days = result.days;
        placedTotal += result.placed.length;
        waitingTotal += result.waiting.length;
        gaveUpTotal += result.gaveUp.length;
        noRoomPlacedTotal += result.noRoomPlaced.length;
        waitingWithNoSession += result.waiting.filter((w) => w.why === 'no_session').length;
        noSessionWeeks += new Set(result.waiting.filter((w) => w.why === 'no_session').map((w) => w.kind)).size;

        for (const [index, d] of days.entries()) {
          const before = written[index];
          // No day longer than written; rest days and the test day untouched (records aside).
          expect(d.durationMinutes).toBeLessThanOrEqual(before.durationMinutes);
          expect(d.detailedSteps.reduce((sum, s) => sum + s.durationMinutes, 0)).toBeLessThanOrEqual(before.durationMinutes);
          if (before.isRestDay || before.isTestDay) expect(d.detailedSteps).toEqual(before.detailedSteps);
          if (before.detailedSteps.length > 0) expect(d.detailedSteps.length).toBeGreaterThan(0);
          // Fixed steps are never removed.
          for (const s of before.detailedSteps) if (actionOf(s, profile)?.action === 'fixed') expect(d.detailedSteps.map((x) => x.title)).toContain(s.title);
        }

        for (const { kind: k, steps: carried } of handoff.carried) {
          // Placed in order: the carried steps placed are a prefix of the list, in date and row order.
          const onDays = days.flatMap((d) => (d.detailedSteps as CarriedStep[]).filter((s) => s.kind === k && s.shiftedFrom).map((s) => s.title));
          const placedTitles = result.placed.filter((p) => p.kind === k).map((p) => p.title);
          expect(onDays).toEqual(placedTitles);
          expect(placedTitles).toEqual(carried.slice(0, placedTitles.length).map((s) => s.title));
          // Nothing lost: the rest wait, in order, as records.
          const recorded = days.flatMap((d) =>
            (d.detailedSteps as CarriedStep[]).flatMap((s) => (s.toNextWeek ?? []).filter((r) => r.step.kind === k).map((r) => r.step.title))
          );
          expect([...placedTitles, ...recorded]).toEqual(carried.map((s) => s.title));
          for (const s of carried) {
            if (placedTitles.includes(s.title)) waits.delete(s.title);
            else {
              waits.set(s.title, (waits.get(s.title) ?? 0) + 1);
              longestWait = Math.max(longestWait, waits.get(s.title)!);
            }
          }
        }

        // The rest gap: a placed hard step has no other hard step within the gap, unless it took a hard step's place
        // (then only its own day counts), on this week's days and last week's done days.
        const isHard = (s: CarriedStep) => actionOf(s, profile)?.hard ?? s.highLoad === true;
        const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
        for (const [index, d] of days.entries()) {
          for (const s of d.detailedSteps as CarriedStep[]) {
            if (!s.shiftedFrom || !isHard(s)) continue;
            const reach = written[index].detailedSteps.some(isHard) ? 0 : profile.restGapDays;
            for (const other of days) {
              if (Math.abs(dayNumber(other.date) - dayNumber(d.date)) > reach) continue;
              expect(
                (other.detailedSteps as CarriedStep[]).some((x) => x !== s && isHard(x)),
                `${s.title} near a hard step`
              ).toBe(false);
            }
            for (const done of previous) {
              if (done.status !== 'completed' || done.isRestDay || Math.abs(dayNumber(done.date) - dayNumber(d.date)) > reach) continue;
              expect(done.steps.some(isHard), `${s.title} near last week's hard step`).toBe(false);
            }
          }
        }

        // No double counting: with both weeks stored, last week lists none of what this week holds.
        const both = [...previous, ...store(week, days)];
        const classified: DayClassification[] = both.map((t) => ({
          taskId: t.id,
          date: t.date,
          weekNumber: t.weekNumber,
          dayNumber: t.dayNumber,
          isKeySession: false,
          isTestDay: t.isTestDay,
          kind: t.isRestDay ? 'rest' : t.weekNumber < week ? (t.status === 'completed' ? 'done' : 'missed') : 'planned',
        }));
        for (const queue of inOrderQueue({
          days: classified,
          tasks: both,
          profile,
          today: dateOf(week, 0),
        })) {
          if (queue.weekNumber < week) expect(queue.steps, `week ${queue.weekNumber} still lists handed-on steps`).toEqual([]);
        }
      }

      // The week happens: each practice day done or not, sometimes a three-day break.
      const done: Name[] = ['sat'];
      let breakLeft = 0;
      for (const name of ['mon', 'tue', 'wed', 'fri'] as const) {
        if (breakLeft === 0 && random() < 0.08) breakLeft = 3;
        if (breakLeft > 0) breakLeft -= 1;
        else if (random() < 0.7) done.push(name);
      }
      const stored = store(week, days, done);
      // Expected next carried list: the carried steps not done, in their order, then this week's own steps of the
      // kind not done, in written order. Checked at the next handoff.
      if (week < 12) previous = stored;
      else {
        const end = weekHandoff({ tasks: stored, profile });
        leftAtTheEnd += end.carried.reduce((sum, c) => sum + c.steps.length, 0);
      }
      if (previous && week < 12) {
        const next = weekHandoff({ tasks: previous, profile });
        for (const k of sequenceKinds) {
          const notDone = (t: HandoffTask) => t.status !== 'completed' && !t.isRestDay && !t.isTestDay;
          const fromRecords = previous.flatMap((t) => t.steps.flatMap((s) => (s.toNextWeek ?? []).filter((r) => r.step.kind === k)));
          const placedNotDone = previous.filter(notDone).flatMap((t) => t.steps.filter((s) => s.kind === k && s.shiftedFrom));
          const ownNotDone = previous.filter(notDone).flatMap((t) => t.steps.filter((s) => s.kind === k && !s.shiftedFrom));
          // Placed and waiting steps come from earlier weeks, in their order (placed first); the week's own after.
          const expected = [
            ...[
              ...placedNotDone.map((s) => ({
                title: s.title,
                date: s.shiftedFrom!.date,
                n: s.shiftedFrom!.stepNumber ?? 0,
              })),
              ...fromRecords.map((r) => ({
                title: r.step.title,
                date: r.date,
                n: r.step.stepNumber,
              })),
            ]
              .sort((a, b) => (a.date === b.date ? a.n - b.n || (a.title < b.title ? -1 : 1) : a.date < b.date ? -1 : 1))
              .map((s) => s.title),
            ...ownNotDone.map((s) => s.title),
          ];
          expect(lessonsCarried(next, k), `week ${week} ${k}`).toEqual(expected);
        }
      }
    }
  }

  return {
    handoffs,
    noSessionWeeks,
    placedTotal,
    waitingTotal,
    waitingWithNoSession,
    gaveUpTotal,
    noRoomPlacedTotal,
    longestWait,
    leftAtTheEnd,
  };
}

describe('generated handoffs (AC-14, requirement 9)', () => {
  it('over many plans, no in-order step is lost or placed out of order, no day is longer, and only week 12 lets a step go', () => {
    for (const follows of [false, true]) {
      const stats = simulate(follows ? 2718 : 3141, follows);
      // Enough happened to mean something.
      expect(stats.handoffs).toBe(400 * 11);
      expect(stats.placedTotal).toBeGreaterThan(1500);
      expect(stats.waitingTotal).toBeGreaterThan(300);
      expect(stats.gaveUpTotal).toBeGreaterThan(50);
      expect(stats.noRoomPlacedTotal).toBeGreaterThan(100);
      // The measurement (requirement 9): reported, never a failure.
      console.info(
        `[M3.1d generated, writer ${follows ? 'follows the prompt' : 'picks kinds at random'}] ${stats.handoffs} handoffs: ${stats.placedTotal} steps placed, ` +
          `${stats.waitingTotal} waits (${stats.waitingWithNoSession} in ${stats.noSessionWeeks} handoffs where the writer wrote no session of the kind), ` +
          `${stats.gaveUpTotal} sessions gave their step up, ${stats.noRoomPlacedTotal} no-room steps placed; longest wait ${stats.longestWait} weeks in a row; ` +
          `${stats.leftAtTheEnd} steps not done at the end of week 12`
      );
    }
  });
});
