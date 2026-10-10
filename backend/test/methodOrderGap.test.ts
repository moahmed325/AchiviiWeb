import { describe, it, expect } from 'vitest';
import { planCarries, swappedTaskIds, type CarriedStep, type CarryInput, type CarryTask } from '../src/lib/carryForward.js';
import { findOpenGap, type DayClassification, type DayKind } from '../src/lib/missedSessions.js';
import { weekCounts } from '../src/lib/missedSignals.js';
import { EASY_START_LINE, MOVED_WARM_UP_LINE, planRecovery, takePlace, withEasyLine, withWarmUpLine, type RecoveryPlan } from '../src/lib/recovery/carry.js';
import { inOrderMoveKinds, inOrderQueue } from '../src/lib/recovery/inOrder.js';
import { actionOf, profileFailures, withFixedKinds, type RecoveryKind, type RecoveryProfile } from '../src/lib/recovery/profile.js';

// Method-aware recovery M3.1b and M3.1c: the rest gap (RULE-14), in-order steps never lost (RULE-20: the reorder, the
// queue, next week's list and its count), the easy first hard session back (RULE-21), the warm-up line only on physical
// steps (MR-31), and generated weeks (AC-6, AC-14). Pure: the one-transaction write is in methodReconcile.test.ts.

const CUSTOM = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };
const RUN10K = { rawGoal: 'Run a 10k', clarifiedOutcome: 'Run 10 km without stopping' };

const kind = (id: string, overrides: Partial<RecoveryKind> = {}): RecoveryKind => ({
  id,
  name: id.replace(/_/g, ' '),
  description: `A ${id} step.`,
  action: 'move',
  hard: false,
  inOrder: false,
  ...overrides,
});

function profileWith(restGapDays: number): RecoveryProfile {
  return withFixedKinds({
    version: 1,
    template: 'general',
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
    returnRule: { breaks: [{ length: 'any', restart: 'last level' }], firstWeekBack: 'Ease back in.' },
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

/** A day: its main step of `kindId` (priority 1), then a let-go review and a general extra. 30 minutes. */
const day = (tag: string, kindId: string, extra: Partial<CarriedStep> = {}): CarriedStep[] => [
  step(tag, 1, 15, kindId, extra),
  step(`${tag} review`, 2, 10, 'review'),
  step(`${tag} extra`, 3, 5, 'general'),
];

interface DaySpec {
  kind?: DayKind;
  key?: boolean;
  steps?: CarriedStep[];
  minutes?: number;
  /** Overrides the week's rest days (Thu and Sun). */
  rest?: boolean;
}

/**
 * Weeks from Monday 2026-09-14 (week 1, "last week") and 2026-09-21 (week 2). In each week Thu and Sun are rest
 * days and Sat is the test day. Days are named `${week}-${mon..sun}`; unnamed practice days hold practice steps.
 */
const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Name = (typeof NAMES)[number];
const dateOf = (week: number, index: number) => {
  const t = Date.parse('2026-09-14T00:00:00Z') + ((week - 1) * 7 + index) * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
};

function weeks(
  spec: Partial<Record<`${1 | 2}-${Name}`, DaySpec>>,
  options: { today: string; goal?: CarryInput['goal']; untagged?: boolean }
): CarryInput {
  const tasks: CarryTask[] = [];
  const days: DayClassification[] = [];
  for (const week of [1, 2] as const) {
    NAMES.forEach((name, index) => {
      const key = `${week}-${name}` as const;
      const s = spec[key] ?? {};
      const isRestDay = s.rest ?? (name === 'thu' || name === 'sun');
      const isTestDay = name === 'sat';
      const testSteps = [step('Weekly test: 1-minute test', 1, 20, 'weekly_test'), step('Compare', 2, 10, 'weekly_test')];
      let steps = s.steps ?? (isRestDay ? [] : isTestDay ? testSteps : day(`${key} practice`, 'practice'));
      if (options.untagged) steps = steps.map(({ kind: _k, ...rest }) => rest as CarriedStep);
      const date = dateOf(week, index);
      const defaultKind: DayKind = isRestDay ? 'rest' : date < options.today ? 'done' : 'planned';
      const dayKind = isRestDay ? 'rest' : s.kind ?? defaultKind;
      tasks.push({
        id: key,
        date,
        weekNumber: week,
        dayNumber: index + 1,
        status: dayKind === 'done' ? 'completed' : 'pending',
        isRestDay,
        isKeySession: !!s.key,
        isTestDay,
        durationMinutes: s.minutes ?? steps.reduce((sum, x) => sum + x.durationMinutes, 0),
        steps,
      });
      days.push({ taskId: key, date, weekNumber: week, dayNumber: index + 1, isKeySession: !!s.key, isTestDay, kind: dayKind });
    });
  }
  return { days, gap: findOpenGap(days), tasks, goal: options.goal ?? CUSTOM, today: options.today, timezone: 'UTC', sleepTime: '23:00' };
}

const on = (input: CarryInput, profile: RecoveryProfile | null = PROFILE) => planRecovery({ ...input, method: { profile } });
const dropOf = (plan: RecoveryPlan, taskId: string) => plan.drops.find((d) => d.taskId === taskId)?.reason;
const outcomeOf = (plan: RecoveryPlan, taskId: string) => plan.outcomes!.find((o) => o.taskId === taskId);
/** The day's new row in the plan (every entry for one day carries the same final row). */
const rowOf = (plan: RecoveryPlan, taskId: string) =>
  (plan.reorders ?? []).flatMap((r) => r.rows).find((r) => r.taskId === taskId)?.steps ??
  plan.carries.find((c) => c.toTaskId === taskId)?.steps ??
  (plan.easyStart?.taskId === taskId ? plan.easyStart.steps : undefined);
const countable = (input: CarryInput) => input.tasks.map((t) => ({ id: t.id, weekNumber: t.weekNumber, isRestDay: t.isRestDay, isKeySession: t.isKeySession }));

/** Writes every planned row back into the input, as reconcile does with the carry switch on. */
function store(input: CarryInput, plan: RecoveryPlan): CarryInput {
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of plan.carries) rows.set(carry.toTaskId, carry);
  for (const reorder of plan.reorders ?? []) for (const row of reorder.rows) rows.set(row.taskId, row);
  for (const item of plan.continues ?? []) rows.set(item.toTaskId, item);
  if (plan.easyStart) rows.set(plan.easyStart.taskId, plan.easyStart);
  return {
    ...input,
    tasks: input.tasks.map((task) => (rows.has(task.id) ? { ...task, steps: rows.get(task.id)!.steps, durationMinutes: rows.get(task.id)!.durationMinutes } : task)),
  };
}

describe('the M3.1b and M3.1c test profiles', () => {
  it.each([0, 1, 2])('pass the RULE-4 checks with a rest gap of %i', (gap) => {
    expect(profileFailures(profileWith(gap))).toEqual([]);
  });
});

describe('RULE-14 the rest gap', () => {
  const TUE = '2026-09-22';

  it('interval run, next day is the long run: not moved onto the long run or the day before it; the next day that passes', () => {
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('intervals', 'heavy') }, '2-tue': { steps: day('long run', 'heavy') } }, { today: TUE });
    const plan = on(input);
    // Tue holds the long run (same day), Wed is 1 day after it; Thu is rest, so Fri.
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['intervals', '2-fri']]);
    expect(plan.carries[0].step.instructions.split('\n')[0]).toBe(MOVED_WARM_UP_LINE);

    const dayBefore = on(weeks({ '2-mon': { kind: 'missed', steps: day('intervals', 'heavy') }, '2-wed': { steps: day('long run', 'heavy') } }, { today: TUE }));
    expect(dayBefore.carries.map((c) => c.toTaskId)).toEqual(['2-fri']);
  });

  it('interval run with no day that passes this week: no room', () => {
    const input = weeks(
      { '2-mon': { kind: 'missed', steps: day('intervals', 'heavy') }, '2-tue': { steps: day('long run', 'heavy') }, '2-wed': { steps: day('tempo', 'heavy') } },
      { today: TUE }
    );
    const plan = on(input, profileWith(2));
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('no_receiving_day');
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ rules: 'method', outcome: 'no_room', topStep: 'no_room' });
  });

  it('a rest gap of 0 only keeps hard steps off a shared day', () => {
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('intervals', 'heavy') }, '2-tue': { steps: day('long run', 'heavy') } }, { today: TUE });
    expect(on(input, profileWith(0)).carries.map((c) => c.toTaskId)).toEqual(['2-wed']);
  });

  it('a hard step on the receiving day that the fit removes does not stay, so the day can take it', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('tue strides', 2, 15, 'heavy')];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('intervals', 'heavy') }, '2-tue': { steps: tue } }, { today: TUE }));
    expect(plan.carries[0]).toMatchObject({ toTaskId: '2-tue' });
    expect(plan.carries[0].replaced.map((s) => s.title)).toEqual(['tue strides']);
  });

  it('reaches into last week: last Sunday\'s untagged high-load step blocks Tuesday with a gap of 2', () => {
    // Last week's Sun (2026-09-20) is a practice day written before kinds; this Mon (09-21) is missed.
    const spec = (sunKind: DayKind) => ({
      '1-sun': { rest: false, kind: sunKind, steps: [step('long run', 1, 30, undefined, { highLoad: true })] },
      '2-mon': { kind: 'missed' as const, steps: day('intervals', 'heavy') },
    });
    // Tue (09-22) is 2 days after it: with a gap of 2 the first day that passes is Wed (09-23).
    expect(on(weeks(spec('done'), { today: TUE }), profileWith(2)).carries.map((c) => c.toTaskId)).toEqual(['2-wed']);
    // With a gap of 1, Tue passes.
    expect(on(weeks(spec('done'), { today: TUE }), profileWith(1)).carries.map((c) => c.toTaskId)).toEqual(['2-tue']);
    // Last Sunday missed: its steps did not happen and do not count.
    expect(on(weeks(spec('missed'), { today: TUE }), profileWith(2)).carries.map((c) => c.toTaskId)).toEqual(['2-tue']);
  });

  it('a missed day\'s steps do not count, and neither does the step\'s own missed day', () => {
    // Mon (missed, hard) and Tue (missed, hard): Tue's own step moves first (most recent) to Wed; Mon's search then
    // sees that carry on Wed, so it skips Tue (closed, 1 day from Wed) and Wed, and lands on Fri.
    const input = weeks(
      { '2-mon': { kind: 'missed', steps: day('mon heavy', 'heavy') }, '2-tue': { kind: 'missed', steps: day('tue heavy', 'heavy') } },
      { today: '2026-09-23' }
    );
    const plan = on(input);
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([
      ['mon heavy', '2-fri'],
      ['tue heavy', '2-wed'],
    ]);
    // A replan after both writes changes nothing.
    const again = on(store(input, plan));
    expect(again.carries).toEqual([]);
    expect(again.alreadyCarried).toHaveLength(2);
  });

  it('this run\'s accepted carries count, so the result is the same as a replan after writing them one by one', () => {
    const input = weeks(
      { '2-mon': { kind: 'missed', steps: day('mon heavy', 'heavy') }, '2-tue': { kind: 'missed', steps: day('tue heavy', 'heavy') } },
      { today: '2026-09-23' }
    );
    const plan = on(input);
    const onlyTue = { ...plan, carries: plan.carries.filter((c) => c.fromTaskId === '2-tue') };
    const replan = on(store(input, onlyTue));
    expect(replan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon heavy', '2-fri']]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// RULE-20 (M3.1c): in-order steps are never lost inside the week.

/** A lesson day: the lesson (priority 1, 15 minutes) and a let-go review (15 minutes), so the lesson is its only move step. */
const lesson = (n: number, extra: Partial<CarriedStep> = {}): CarriedStep[] => [step(`Lesson ${n}`, 1, 15, 'lesson', extra), step(`L${n} review`, 2, 15, 'review')];
const reorderOf = (plan: RecoveryPlan, kind = 'lesson', week = 2) => plan.reorders!.find((r) => r.kind === kind && r.weekNumber === week);
const holds = (plan: RecoveryPlan, kind = 'lesson') => reorderOf(plan, kind)!.sessions.map((s) => [s.taskId, s.holds?.title ?? null]);
const nextWeek = (plan: RecoveryPlan, kind = 'lesson') => reorderOf(plan, kind)?.toNextWeek.map((s) => s.title) ?? [];
const titlesOn = (input: CarryInput, taskId: string) => input.tasks.find((t) => t.id === taskId)!.steps.map((s) => s.title);
const later = (input: CarryInput, today: string, kinds: Partial<Record<string, DayKind>>): CarryInput => ({
  ...input,
  today,
  days: input.days.map((d) => (kinds[d.taskId] ? { ...d, kind: kinds[d.taskId]! } : d)),
  gap: findOpenGap(input.days.map((d) => (kinds[d.taskId] ? { ...d, kind: kinds[d.taskId]! } : d))),
});
/** A replan of the stored plan writes nothing. */
function expectStable(input: CarryInput, profile: RecoveryProfile = PROFILE) {
  const again = on(input, profile);
  expect(again.reorders!.flatMap((r) => r.rows)).toEqual([]);
  expect(again.continues).toEqual([]);
  expect(again.easyStart).toBeNull();
  return again;
}

describe('RULE-20 the in-order queue (M3.1c)', () => {
  /** Lessons on Mon (3, missed), Tue (4, today), Wed (5) and Fri (6). */
  const lessonWeek = (over: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {}) =>
    weeks({ '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { steps: lesson(4) }, '2-wed': { steps: lesson(5) }, '2-fri': { steps: lesson(6) }, ...over }, { today: '2026-09-22' });

  it('Lesson 3 missed: Tue, Wed and Fri hold Lessons 3, 4 and 5, Lesson 6 is listed for next week, and nothing is lost', () => {
    const input = lessonWeek();
    const plan = on(input);
    expect(holds(plan)).toEqual([
      ['2-tue', 'Lesson 3'],
      ['2-wed', 'Lesson 4'],
      ['2-fri', 'Lesson 5'],
    ]);
    expect(nextWeek(plan)).toEqual(['Lesson 6']);
    const tue = rowOf(plan, '2-tue')!;
    expect(tue.map((s) => [s.title, s.priority, s.stepNumber])).toEqual([
      ['Lesson 3', 1, 1],
      ['L4 review', 2, 2],
    ]);
    // The marker names the day the step was written on; a lesson is not physical, so no warm-up line (MR-31).
    expect(tue[0]).toMatchObject({ instructions: 'Do Lesson 3.', shiftedFrom: { taskId: '2-mon', date: '2026-09-21' } });
    expect(tue[0].shiftedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson 4']);
    expect(rowOf(plan, '2-wed')![0]).toMatchObject({ title: 'Lesson 4', shiftedFrom: { taskId: '2-tue', date: '2026-09-22' } });
    expect(rowOf(plan, '2-fri')![0]).toMatchObject({ title: 'Lesson 5', shiftedFrom: { taskId: '2-wed', date: '2026-09-23' } });
    // Lesson 6 is stored nowhere else, so its record goes on Mon's Lesson 3 (the missed day keeps its steps).
    const mon = rowOf(plan, '2-mon')!;
    expect(mon.map((s) => s.title)).toEqual(['Lesson 3', 'L3 review']);
    expect(mon[0].toNextWeek).toEqual([{ taskId: '2-fri', date: '2026-09-25', step: lesson(6)[0] }]);
    expect(plan.carries).toEqual([]);
    expect(plan.drops).toEqual([]);
    expect(outcomeOf(plan, '2-mon')).toEqual({ taskId: '2-mon', date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' });
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 1, noRoom: 0, letGo: 0, continued: 0 });
    expect(weekCounts(1, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 0 });

    // A replan writes nothing and gives the same result and count.
    const stored = store(input, plan);
    const again = expectStable(stored);
    expect(holds(again)).toEqual(holds(plan));
    expect(nextWeek(again)).toEqual(['Lesson 6']);
    expect(outcomeOf(again, '2-mon')).toMatchObject({ outcome: 'moved' });
    expect(weekCounts(2, { tasks: countable(stored), days: stored.days, carry: again })).toMatchObject({ toNextWeek: 1 });
  });

  it('the queue function lists the steps not done, in order, from the stored week (M3.1d reads it at the week\'s end)', () => {
    const input = lessonWeek();
    expect(inOrderQueue({ ...input, profile: PROFILE }).map((q) => [q.weekNumber, q.kind, q.steps.map((s) => [s.title, s.status])])).toEqual([
      [
        2,
        'lesson',
        [
          ['Lesson 3', 'missed'],
          ['Lesson 4', 'session'],
          ['Lesson 5', 'session'],
          ['Lesson 6', 'session'],
        ],
      ],
    ]);
    const stored = store(input, on(input));
    // The week ends with Tue done and Wed, Fri missed: Lessons 4 and 5 are on missed days, then Lesson 6 as listed.
    const end = later(stored, '2026-09-28', { '2-tue': 'done', '2-wed': 'missed', '2-fri': 'missed', '2-sat': 'done' });
    expect(inOrderQueue({ ...end, profile: PROFILE }).map((q) => q.steps.map((s) => [s.title, s.status, s.origin.taskId]))).toEqual([
      [
        ['Lesson 4', 'missed', '2-tue'],
        ['Lesson 5', 'missed', '2-wed'],
        ['Lesson 6', 'next_week', '2-fri'],
      ],
    ]);
    expect(nextWeek(on(end))).toEqual(['Lesson 4', 'Lesson 5', 'Lesson 6']);
  });

  it('lessons 4 to 6 missed in a break: the rest of the week does 4, 5 and 6, and 7 to 9 are listed for next week', () => {
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: lesson(4) },
        '2-tue': { kind: 'missed', steps: lesson(5) },
        '2-wed': { kind: 'missed', steps: lesson(6) },
        '2-thu': { rest: false, steps: lesson(7) },
        '2-fri': { steps: lesson(8) },
        '2-sun': { rest: false, steps: lesson(9) },
      },
      { today: '2026-09-24' }
    );
    expect(input.gap).toMatchObject({ length: 3 });
    const plan = on(input);
    expect(holds(plan)).toEqual([
      ['2-thu', 'Lesson 4'],
      ['2-fri', 'Lesson 5'],
      ['2-sun', 'Lesson 6'],
    ]);
    expect(nextWeek(plan)).toEqual(['Lesson 7', 'Lesson 8', 'Lesson 9']);
    expect(rowOf(plan, '2-mon')![0].toNextWeek!.map((r) => [r.taskId, r.step.title])).toEqual([
      ['2-thu', 'Lesson 7'],
      ['2-fri', 'Lesson 8'],
      ['2-sun', 'Lesson 9'],
    ]);
    // ND-11 for everything else: nothing is carried out of the break, and the gap days keep `in_gap`.
    expect(plan.carries).toEqual([]);
    expect(plan.outcomes!.map((o) => o.outcome)).toEqual(['in_gap', 'in_gap', 'in_gap']);
    expect(plan.drops.map((d) => d.reason)).toEqual(['in_gap', 'in_gap', 'in_gap']);
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 3, noRoom: 0 });
    expectStable(store(input, plan));
  });

  it('a lower-priority lesson on a missed day is not lost; the day\'s top move step follows its own action', () => {
    const mon = [step('mon practice', 1, 15, 'practice'), step('Lesson 3', 2, 15, 'lesson')];
    const input = weeks({ '2-mon': { kind: 'missed', steps: mon }, '2-tue': { steps: lesson(4) }, '2-wed': { steps: lesson(5) } }, { today: '2026-09-22' });
    const plan = on(input);
    expect(holds(plan)).toEqual([
      ['2-tue', 'Lesson 3'],
      ['2-wed', 'Lesson 4'],
    ]);
    expect(nextWeek(plan)).toEqual(['Lesson 5']);
    // RULE-9 for the practice step, onto Tue's new row: the review makes room, the lesson is never trimmed.
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon practice', '2-tue']]);
    expect(rowOf(plan, '2-tue')!.map((s) => s.title)).toEqual(['Lesson 3', 'mon practice']);
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'moved', topStep: 'moved' });
    expectStable(store(input, plan));
  });

  it('a moved lesson missed again is not lost, and neither is it twice more (a break)', () => {
    const input = lessonWeek();
    const first = store(input, on(input));
    // Tue (holding Lesson 3) is missed too: Wed and Fri now hold Lessons 3 and 4.
    const tueMissed = later(first, '2026-09-23', { '2-tue': 'missed' });
    const second = on(tueMissed);
    expect(holds(second)).toEqual([
      ['2-wed', 'Lesson 3'],
      ['2-fri', 'Lesson 4'],
    ]);
    expect(nextWeek(second)).toEqual(['Lesson 5', 'Lesson 6']);
    expect(rowOf(second, '2-wed')![0].shiftedFrom).toMatchObject({ taskId: '2-mon' });
    expect(outcomeOf(second, '2-mon')).toMatchObject({ outcome: 'moved' });
    expect(outcomeOf(second, '2-tue')).toMatchObject({ outcome: 'moved', topStep: 'moved' });
    const stored = store(tueMissed, second);
    expectStable(stored);

    // Wed is missed as well (Mon to Wed is now a break): Fri holds Lesson 3, and 4 to 6 wait for next week.
    const wedMissed = later(stored, '2026-09-25', { '2-wed': 'missed' });
    const third = on(wedMissed);
    expect(holds(third)).toEqual([['2-fri', 'Lesson 3']]);
    expect(nextWeek(third)).toEqual(['Lesson 4', 'Lesson 5', 'Lesson 6']);
    expect(third.outcomes!.map((o) => o.outcome)).toEqual(['in_gap', 'in_gap', 'in_gap']);
    expectStable(store(wedMissed, third));
  });

  it('the last lesson of the week missed is listed for next week', () => {
    const input = weeks(
      { '2-mon': { kind: 'done', steps: lesson(3) }, '2-tue': { kind: 'done', steps: lesson(4) }, '2-wed': { kind: 'done', steps: lesson(5) }, '2-fri': { kind: 'missed', steps: lesson(6) } },
      { today: '2026-09-26' }
    );
    const plan = on(input);
    expect(reorderOf(plan)).toMatchObject({ sessions: [], rows: [] });
    expect(nextWeek(plan)).toEqual(['Lesson 6']);
    expect(outcomeOf(plan, '2-fri')).toEqual({ taskId: '2-fri', date: '2026-09-25', rules: 'method', outcome: 'next_week', topStep: 'next_week' });
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 1, noRoom: 0 });
  });

  it('a session too short for the next lesson gives its own up, and the next session is tried (MR-30 (5))', () => {
    const input = lessonWeek({
      '2-mon': { kind: 'missed', steps: [step('Lesson 3', 1, 20, 'lesson'), step('L3 review', 2, 10, 'review')] },
      '2-tue': { steps: [step('Lesson 4', 1, 15, 'lesson'), step('Group class', 2, 15, 'fixed_time_session')] },
      '2-wed': { steps: day('Lesson 5', 'lesson') },
      '2-fri': { steps: day('Lesson 6', 'lesson') },
    });
    const plan = on(input);
    // Tue cannot take the 20-minute Lesson 3 (its class is fixed), so it gives up Lesson 4; Wed takes Lesson 3 by
    // trimming its extra, and Fri takes Lesson 4.
    expect(holds(plan)).toEqual([
      ['2-tue', null],
      ['2-wed', 'Lesson 3'],
      ['2-fri', 'Lesson 4'],
    ]);
    expect(nextWeek(plan)).toEqual(['Lesson 5', 'Lesson 6']);
    expect(rowOf(plan, '2-tue')!.map((s) => [s.title, s.priority])).toEqual([['Group class', 1]]);
    expect(reorderOf(plan)!.rows.find((r) => r.taskId === '2-tue')!.durationMinutes).toBe(15);
    const wed = rowOf(plan, '2-wed')!;
    expect(wed.map((s) => s.title)).toEqual(['Lesson 3', 'Lesson 5 review']);
    expect(wed[0].shiftedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson 5', 'Lesson 5 extra']);
    expect(reorderOf(plan)!.rows.find((r) => r.taskId === '2-wed')!.durationMinutes).toBe(30);
    expect(rowOf(plan, '2-mon')![0].toNextWeek!.map((r) => r.step.title)).toEqual(['Lesson 5', 'Lesson 6']);
    expectStable(store(input, plan));
  });

  it('a longer lesson trims the lowest-priority steps of its new session, never a fixed, continue-marked or swapped one', () => {
    const wed = [
      step('Lesson 5', 1, 10, 'lesson'),
      step('Group class', 2, 5, 'fixed_time_session'),
      step('wed drafting', 3, 5, 'drafting', { continueFrom: { taskId: '1-fri', date: '2026-09-18' } }),
      step('swapped review', 4, 5, 'review', { swappedFrom: { taskId: '1-fri', date: '2026-09-18' } }),
      step('wed review', 5, 5, 'review'),
    ];
    const plan = on(lessonWeek({ '2-wed': { steps: wed }, '2-tue': { steps: [step('Lesson 4', 1, 15, 'lesson'), step('tue review', 2, 15, 'review')] } }));
    // Wed takes Lesson 4 (15 minutes): only its own review may go.
    expect(rowOf(plan, '2-wed')!.map((s) => s.title)).toEqual(['Lesson 4', 'Group class', 'wed drafting', 'swapped review']);
    expect(rowOf(plan, '2-wed')!.find((s) => s.title === 'wed drafting')!.continueFrom).toEqual({ taskId: '1-fri', date: '2026-09-18' });
    expect(rowOf(plan, '2-wed')!.find((s) => s.title === 'swapped review')!.swappedFrom).toEqual({ taskId: '1-fri', date: '2026-09-18' });
  });

  it('a reorder never trims a step of another in-order kind: the session gives its lesson up instead', () => {
    const plan = on(lessonWeek({ '2-wed': { steps: [step('Lesson 5', 1, 5, 'lesson'), step('Strength B', 2, 25, 'strength')] } }));
    expect(holds(plan)).toEqual([
      ['2-tue', 'Lesson 3'],
      ['2-wed', null],
      ['2-fri', 'Lesson 4'],
    ]);
    expect(rowOf(plan, '2-wed')!.map((s) => s.title)).toEqual(['Strength B']);
    expect(nextWeek(plan)).toEqual(['Lesson 5', 'Lesson 6']);
  });

  it('a step of another kind is never moved by the reorder, and a carried step is never trimmed by it', () => {
    const carriedIn = step('old carry', 2, 10, 'practice', { carriedFrom: { taskId: '1-fri', date: '2026-09-18', replaced: [] } });
    const plan = on(lessonWeek({ '2-tue': { steps: [step('Lesson 4', 1, 10, 'lesson'), carriedIn, step('tue review', 3, 10, 'review')] } }));
    // Tue takes Lesson 3 (15 minutes) by trimming its review; the stored carry stays where it is.
    expect(rowOf(plan, '2-tue')!.map((s) => s.title)).toEqual(['Lesson 3', 'old carry']);
    expect(rowOf(plan, '2-tue')![1].carriedFrom).toEqual(carriedIn.carriedFrom);
  });

  it('MR-29: Mon/Wed/Fri strength with a gap of 2, Mon missed: the sessions keep their slots, with the warm-up line (MR-31)', () => {
    const input = weeks(
      { '2-mon': { kind: 'missed', steps: day('Strength A', 'strength') }, '2-wed': { steps: day('Strength B', 'strength') }, '2-fri': { steps: day('Strength C', 'strength') } },
      { today: '2026-09-22' }
    );
    const plan = on(input, profileWith(2));
    expect(holds(plan, 'strength')).toEqual([
      ['2-wed', 'Strength A'],
      ['2-fri', 'Strength B'],
    ]);
    expect(nextWeek(plan, 'strength')).toEqual(['Strength C']);
    // A hard step is physical: the line goes first on every step that changed session.
    expect(rowOf(plan, '2-wed')![0].instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo Strength A.`);
    expect(rowOf(plan, '2-fri')![0].instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo Strength B.`);
    // Mon's general extra moves too (RULE-9); it is not physical in a general goal, so it has no line.
    expect(plan.carries.map((c) => [c.step.title, c.step.instructions])).toEqual([['Strength A extra', 'Do Strength A extra.']]);
    expectStable(store(input, plan), profileWith(2));
  });

  it('MR-29, MR-30 (5): a hard step landing on a session that had no hard step, within the gap, makes that session give its step up', () => {
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: lesson(3, { highLoad: true }) },
        '2-tue': { steps: lesson(4) },
        '2-wed': { steps: day('intervals', 'heavy') },
        '2-fri': { steps: lesson(5) },
      },
      { today: '2026-09-22' }
    );
    const plan = on(input);
    expect(holds(plan)).toEqual([
      ['2-tue', null],
      ['2-fri', 'Lesson 3'],
    ]);
    expect(nextWeek(plan)).toEqual(['Lesson 4', 'Lesson 5']);
    // A high-load lesson is hard, so it is physical and gets the warm-up line.
    expect(rowOf(plan, '2-fri')![0].instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo Lesson 3.`);
    // Without the intervals day, Tue takes it.
    const free = on(weeks({ '2-mon': { kind: 'missed', steps: lesson(3, { highLoad: true }) }, '2-tue': { steps: lesson(4) }, '2-fri': { steps: lesson(5) } }, { today: '2026-09-22' }));
    expect(holds(free)).toEqual([
      ['2-tue', 'Lesson 3'],
      ['2-fri', 'Lesson 4'],
    ]);
  });

  it('MR-29: a placed hard step never shares a day with a hard step that stays there', () => {
    const wed = [step('Strength B', 1, 15, 'strength'), step('wed intervals', 2, 15, 'heavy')];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Strength A', 'strength') }, '2-wed': { steps: wed }, '2-fri': { steps: day('Strength C', 'strength') } }, { today: '2026-09-22' }));
    expect(holds(plan, 'strength')).toEqual([
      ['2-wed', null],
      ['2-fri', 'Strength A'],
    ]);
    expect(rowOf(plan, '2-wed')!.map((s) => s.title)).toEqual(['wed intervals']);
    expect(nextWeek(plan, 'strength')).toEqual(['Strength B', 'Strength C']);
  });

  it('never on the test day or a rest day', () => {
    // Sat (test) and Sun (rest) never hold a lesson, so only Tue and Wed are sessions.
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { steps: lesson(4) }, '2-wed': { steps: lesson(5) } }, { today: '2026-09-22' }));
    expect(holds(plan).map(([taskId]) => taskId)).toEqual(['2-tue', '2-wed']);
    expect(reorderOf(plan)!.rows.map((r) => r.taskId).sort()).toEqual(['2-mon', '2-tue', '2-wed']);
  });

  it('only the week holding today and the week before: a lesson missed in week 2 adds nothing to week 4\'s body', () => {
    // Weeks 1 and 2 as usual, then weeks 3 and 4 (copies of week 1's practice days); today is week 4's Tuesday.
    const base = weeks(
      { '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { kind: 'done', steps: lesson(4) }, '2-wed': { kind: 'done', steps: lesson(5) } },
      { today: '2026-09-23' }
    );
    const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    const today = shift('2026-09-15', 21);
    const later = [3, 4].flatMap((week) =>
      base.tasks
        .filter((t) => t.weekNumber === 1)
        .map((t) => {
          const date = shift(t.date, (week - 1) * 7);
          return { task: { ...t, id: `${week}${t.id.slice(1)}`, date, weekNumber: week, status: date < today ? 'completed' : 'pending' }, kind: (t.isRestDay ? 'rest' : date < today ? 'done' : 'planned') as DayKind };
        })
    );
    const days = [
      ...base.days.map((d) => (d.kind === 'planned' ? { ...d, kind: 'done' as const } : d)),
      ...later.map(({ task, kind }) => ({ taskId: task.id, date: task.date, weekNumber: task.weekNumber, dayNumber: task.dayNumber, isKeySession: false, isTestDay: task.isTestDay, kind })),
    ];
    const input: CarryInput = { ...base, today, days, gap: findOpenGap(days), tasks: [...base.tasks, ...later.map(({ task }) => task)] };
    const plan = on(input);
    expect(plan.reorders).toEqual([]);
    // Week 2's day keeps what it had before M3.1c: its lesson's next session is done, so no room.
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ rules: 'method', outcome: 'no_room', topStep: 'no_room' });
    expect(dropOf(plan, '2-mon')).toBe('receiving_day_done');
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 0 });
    // In week 3 (the week before), the same day is still listed for next week.
    const inWeek3 = on({ ...input, today: shift(today, -7) });
    expect(inWeek3.reorders!.map((r) => r.weekNumber)).toEqual([2]);
    expect(nextWeek(inWeek3)).toEqual(['Lesson 3']);
  });

  it('the in-order kind of each week is reordered on its own (last week\'s missed lesson goes to its own list)', () => {
    const input = weeks({ '1-fri': { kind: 'missed', steps: lesson(1) }, '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { steps: lesson(4) } }, { today: '2026-09-22' });
    const plan = on(input);
    expect(reorderOf(plan, 'lesson', 1)).toMatchObject({ sessions: [], rows: [], toNextWeek: [{ title: 'Lesson 1' }] });
    expect(holds(plan)).toEqual([['2-tue', 'Lesson 3']]);
    expect(weekCounts(1, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 1 });
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ toNextWeek: 1 });
  });

  describe('the kind waits, and nothing changes (nothing is lost: the missed steps stay listed)', () => {
    it('a key session waiting for its swap answer (ND-9)', () => {
      const input = lessonWeek({ '2-mon': { kind: 'missed', key: true, steps: lesson(3) } });
      const plan = on(input);
      expect(reorderOf(plan)).toMatchObject({ waits: 'held', rows: [] });
      expect(nextWeek(plan)).toEqual(['Lesson 3']);
      expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'held' });
      expect(plan.held.map((h) => h.taskId)).toEqual(['2-mon']);
    });

    it('a day before today that has not closed yet', () => {
      const input = weeks({ '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { kind: 'planned', steps: lesson(4) }, '2-wed': { steps: lesson(5) } }, { today: '2026-09-23' });
      const plan = on(input);
      expect(reorderOf(plan)).toMatchObject({ waits: 'still_open', rows: [] });
      expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'next_week', topStep: 'next_week' });
    });

    it('a session holding a swapped step (ND-18): it is never replaced, and the swap marker survives', () => {
      const input = lessonWeek({ '2-tue': { steps: lesson(4, { swappedFrom: { taskId: '1-fri', date: '2026-09-18' } }) } });
      const plan = on(input);
      expect(reorderOf(plan)).toMatchObject({ waits: 'swapped', rows: [] });
      expect(swappedTaskIds(store(input, plan).tasks)).toEqual(swappedTaskIds(input.tasks));
    });

    it('a day of the queue with a step without a kind (RULE-18)', () => {
      const untaggedTue = [step('Lesson 4', 1, 15, 'lesson'), step('old step', 2, 15)];
      const plan = on(lessonWeek({ '2-tue': { steps: untaggedTue } }));
      expect(reorderOf(plan)).toMatchObject({ waits: 'not_tagged', rows: [] });
    });

    it('a day the reorder uses with two steps of the kind', () => {
      const plan = on(lessonWeek({ '2-wed': { steps: [step('Lesson 5', 1, 15, 'lesson'), step('Lesson 5b', 2, 15, 'lesson')] } }));
      expect(reorderOf(plan)).toMatchObject({ waits: 'two_in_a_day', rows: [] });
    });

    it('a done day with two lessons does not stop the reorder (only the days it uses count)', () => {
      const input = weeks(
        { '2-mon': { kind: 'done', steps: [step('Lesson 1', 1, 15, 'lesson'), step('Lesson 2', 2, 15, 'lesson')] }, '2-tue': { kind: 'missed', steps: lesson(3) }, '2-wed': { steps: lesson(4) } },
        { today: '2026-09-23' }
      );
      const plan = on(input);
      expect(reorderOf(plan)!.waits).toBeNull();
      expect(holds(plan)).toEqual([['2-wed', 'Lesson 3']]);
      expect(nextWeek(plan)).toEqual(['Lesson 4']);
    });

    it('a session whose only step is its lesson, too short for the missed one: never left empty (`only_step`)', () => {
      const input = weeks(
        {
          '2-mon': { kind: 'missed', steps: [step('Lesson 4', 1, 20, 'lesson'), step('L4 review', 2, 10, 'review')] },
          '2-tue': { steps: [step('Lesson 5', 1, 15, 'lesson')] },
          '2-wed': { steps: lesson(6) },
        },
        { today: '2026-09-22' }
      );
      const plan = on(input);
      expect(reorderOf(plan)).toMatchObject({ waits: 'only_step', rows: [] });
      expect(holds(plan)).toEqual([
        ['2-tue', 'Lesson 5'],
        ['2-wed', 'Lesson 6'],
      ]);
      expect(nextWeek(plan)).toEqual(['Lesson 4']);
      expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'next_week', topStep: 'next_week' });
      expect(store(input, plan).tasks.find((t) => t.id === '2-tue')!.steps.map((s) => s.title)).toEqual(['Lesson 5']);
      expectStable(store(input, plan));
    });
  });
});

describe('RULE-21 the easy first hard session back (M3.1c, MR-31 (1))', () => {
  /** Mon to Wed missed (the open gap); Thu is today (made a practice day) with no hard step. */
  const back = (fri: CarriedStep[], over: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {}) =>
    weeks(
      {
        '2-mon': { kind: 'missed' },
        '2-tue': { kind: 'missed' },
        '2-wed': { kind: 'missed' },
        '2-thu': { rest: false, steps: [step('thu practice', 1, 15, 'practice'), step('thu review', 2, 15, 'review')] },
        '2-fri': { steps: fri },
        ...over,
      },
      { today: '2026-09-24' }
    );

  it('goes first on the first hard step of the first open practice day after the gap that has one, once, with the same minutes', () => {
    const input = back([step('fri practice', 1, 10, 'practice'), step('fri intervals', 2, 10, 'heavy'), step('fri hills', 3, 10, 'heavy')]);
    const plan = on(input);
    expect(plan.easyStart).toMatchObject({ taskId: '2-fri', date: '2026-09-25', stepTitle: 'fri intervals', durationMinutes: 30 });
    expect(plan.easyStart!.steps.map((s) => s.instructions)).toEqual(['Do fri practice.', `${EASY_START_LINE}\nDo fri intervals.`, 'Do fri hills.']);
    expect(plan.easyStart!.steps.map((s) => s.durationMinutes)).toEqual([10, 10, 10]);
    // Not again on a replan.
    const stored = store(input, plan);
    expect(on(stored).easyStart).toBeNull();
    expect(titlesOn(stored, '2-fri')).toEqual(['fri practice', 'fri intervals', 'fri hills']);
  });

  it('no line without an open gap, on the test day, or when no open day this week has a hard step', () => {
    const fri = [step('fri practice', 1, 15, 'practice'), step('fri intervals', 2, 15, 'heavy')];
    expect(on(back(fri, { '2-tue': { kind: 'done' } })).easyStart).toBeNull();
    const highLoadTest = [step('Weekly test: run 3 km', 1, 20, 'weekly_test', { highLoad: true }), step('Compare', 2, 10, 'weekly_test')];
    expect(on(back(day('fri plain', 'practice'), { '2-sat': { steps: highLoadTest } })).easyStart).toBeNull();
  });

  it('a strength step that the reorder places on the first day back gets the easy line, then the warm-up line', () => {
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: day('Strength A', 'strength') },
        '2-tue': { kind: 'missed' },
        '2-wed': { kind: 'missed' },
        '2-fri': { steps: day('Strength B', 'strength') },
      },
      { today: '2026-09-25' }
    );
    const plan = on(input);
    expect(holds(plan, 'strength')).toEqual([['2-fri', 'Strength A']]);
    expect(plan.easyStart).toMatchObject({ taskId: '2-fri', stepTitle: 'Strength A' });
    expect(rowOf(plan, '2-fri')![0].instructions).toBe(`${EASY_START_LINE}\n${MOVED_WARM_UP_LINE}\nDo Strength A.`);
    expect(reorderOf(plan, 'strength')!.rows.find((r) => r.taskId === '2-fri')!.steps).toEqual(plan.easyStart!.steps);
    expectStable(store(input, plan));
  });

  it('the lines are each added once, the easy line first', () => {
    expect(withEasyLine(withEasyLine('Run.'))).toBe(`${EASY_START_LINE}\nRun.`);
    expect(withWarmUpLine(`${EASY_START_LINE}\nRun.`)).toBe(`${EASY_START_LINE}\n${MOVED_WARM_UP_LINE}\nRun.`);
    expect(withWarmUpLine(withWarmUpLine(`${EASY_START_LINE}\nRun.`))).toBe(`${EASY_START_LINE}\n${MOVED_WARM_UP_LINE}\nRun.`);
    expect(withEasyLine(`${MOVED_WARM_UP_LINE}\nRun.`)).toBe(`${EASY_START_LINE}\n${MOVED_WARM_UP_LINE}\nRun.`);
  });
});

describe('MR-31 (2): the warm-up line only on physical steps', () => {
  const missedDrill = () => weeks({ '2-mon': { kind: 'missed', steps: day('mon drill', 'practice') } }, { today: '2026-09-22' });

  it('a moved practice step of a general goal has no line; of an endurance or strength goal it has the line', () => {
    expect(on(missedDrill()).carries[0].step.instructions).toBe('Do mon drill.');
    for (const template of ['endurance', 'strength'] as const) {
      const plan = on(missedDrill(), { ...PROFILE, template });
      expect(plan.carries[0].step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo mon drill.`);
    }
  });

  it('a hard step has the line in any goal; a lesson never does', () => {
    const heavy = on(weeks({ '2-mon': { kind: 'missed', steps: day('mon heavy', 'heavy') } }, { today: '2026-09-22' }));
    expect(heavy.carries[0].step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo mon heavy.`);
    const lessons = on(weeks({ '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { steps: lesson(4) } }, { today: '2026-09-22' }));
    expect(rowOf(lessons, '2-tue')![0].instructions).toBe('Do Lesson 3.');
  });
});

describe('M3.1b review: swap markers survive (ND-18)', () => {
  const SWAP = { taskId: '1-fri', date: '2026-09-18' };

  it('a swapped step is never trimmed by a carry: the search moves on', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('swapped review', 2, 15, 'review', { swappedFrom: SWAP })];
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('mon drill', 'practice') }, '2-tue': { steps: tue } }, { today: '2026-09-22' });
    const plan = on(input);
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon drill', '2-wed']]);
    const after = store(input, plan);
    expect(after.tasks.find((t) => t.id === '2-tue')!.steps).toEqual(tue);
    expect(swappedTaskIds(after.tasks)).toEqual(swappedTaskIds(input.tasks));
  });

  it('a swapped step is never trimmed by a reorder: the session gives its lesson up instead', () => {
    const wed = [step('Lesson 5', 1, 5, 'lesson'), step('swapped review', 2, 25, 'review', { swappedFrom: SWAP })];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: lesson(3) }, '2-tue': { steps: lesson(4) }, '2-wed': { steps: wed } }, { today: '2026-09-22' }));
    expect(holds(plan)).toEqual([
      ['2-tue', 'Lesson 3'],
      ['2-wed', null],
    ]);
    expect(rowOf(plan, '2-wed')!.map((s) => [s.title, s.swappedFrom])).toEqual([['swapped review', SWAP]]);
  });
});

describe('M3.1b review: an ordinary carry never trims an in-order step', () => {
  it('a drill carried onto a day whose lowest-priority step is a lesson moves on to the next day', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('Lesson 4', 2, 15, 'lesson')];
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('mon drill', 'practice') }, '2-tue': { steps: tue } }, { today: '2026-09-22' });
    const plan = on(input);
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon drill', '2-wed']]);
    expect(store(input, plan).tasks.find((t) => t.id === '2-tue')!.steps).toEqual(tue);
    // Missed sessions' planner is unchanged: without the switch it still replaces the lesson.
    expect(planCarries(input).carries[0].replaced.map((s) => s.title)).toEqual(['Lesson 4']);
  });

  it('a drill fits without removing the lesson when another step can make room', () => {
    const tue = [step('tue practice', 1, 10, 'practice'), step('Lesson 4', 2, 10, 'lesson'), step('tue review', 3, 15, 'review')];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('mon drill', 'practice') }, '2-tue': { steps: tue } }, { today: '2026-09-22' }));
    expect(plan.carries[0]).toMatchObject({ toTaskId: '2-tue' });
    expect(plan.carries[0].replaced.map((s) => s.title)).toEqual(['tue review']);
    expect(plan.carries[0].steps.map((s) => s.title)).toContain('Lesson 4');
  });

  it('a high-load step of an in-order continue kind moves (MR-11), but only to a day before the next session of its kind', () => {
    const profile = withFixedKinds({ ...profileWith(1), kinds: [...profileWith(1).kinds.filter((k) => k.id !== 'drafting'), kind('drafting', { action: 'continue', inOrder: true })] });
    const mon = [step('Draft 1', 1, 15, 'drafting', { highLoad: true }), step('mon review', 2, 15, 'review')];
    const before = on(weeks({ '2-mon': { kind: 'missed', steps: mon }, '2-wed': { steps: day('Draft 2', 'drafting') } }, { today: '2026-09-22' }), profile);
    expect(before.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['Draft 1', '2-tue']]);
    const blocked = on(weeks({ '2-mon': { kind: 'missed', steps: mon }, '2-tue': { steps: day('Draft 2', 'drafting') } }, { today: '2026-09-22' }), profile);
    expect(blocked.carries).toEqual([]);
    expect(dropOf(blocked, '2-mon')).toBe('no_receiving_day');
    expect(blocked.reorders).toEqual([]);
  });
});

describe('takePlace', () => {
  it('keeps the place and priority of the step it replaces', () => {
    const row = [step('a', 2, 10, 'general'), step('Lesson 4', 1, 10, 'lesson'), step('c', 3, 10, 'review')];
    const fit = takePlace({ steps: row, durationMinutes: 30 }, row[1], step('Lesson 3', 1, 10, 'lesson'), () => true)!;
    expect(fit.steps.map((s) => [s.title, s.priority, s.stepNumber])).toEqual([
      ['a', 2, 1],
      ['Lesson 3', 1, 2],
      ['c', 3, 3],
    ]);
    expect(fit.durationMinutes).toBe(30);
  });

  it('is null when the step is longer and nothing may be trimmed', () => {
    const row = [step('Lesson 4', 1, 10, 'lesson'), step('c', 2, 10, 'review')];
    expect(takePlace({ steps: row, durationMinutes: 20 }, row[0], step('Lesson 3', 1, 15, 'lesson'), () => false)).toBeNull();
  });
});

describe('RULE-18 with M3.1c: switch off, no profile, or untagged steps give exactly today\'s plan', () => {
  it('a lesson week without the switch, or with no profile, or untagged, is missed sessions\' plan', () => {
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22' });
    expect(planRecovery(input)).toEqual(planCarries(input));
    const { continues: _c, alreadyContinued: _a, outcomes: _o, reorders, easyStart, ...rest } = on(input, null);
    expect(rest).toEqual(planCarries(input));
    expect(reorders).toEqual([]);
    expect(easyStart).toBeNull();
    const untagged = weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22', untagged: true });
    const plan = on(untagged);
    expect({ carries: plan.carries, drops: plan.drops, held: plan.held, alreadyCarried: plan.alreadyCarried }).toEqual(planCarries(untagged));
    expect(plan.reorders).toEqual([]);
    expect(plan.easyStart).toBeNull();
  });

  it('a break in a week without kinds gets no easy line', () => {
    const input = weeks({ '2-mon': { kind: 'missed' }, '2-tue': { kind: 'missed' }, '2-wed': { kind: 'missed' }, '2-fri': { steps: day('fri heavy', 'heavy') } }, { today: '2026-09-25', untagged: true });
    expect(on(input).easyStart).toBeNull();
  });

  it('a run10k week written before kinds: its untagged steps still drop as high_load', () => {
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('easy run', 'practice') } }, { today: '2026-09-22', goal: RUN10K, untagged: true });
    const plan = on(input);
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('high_load');
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ rules: 'missed_sessions', outcome: 'no_room' });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// AC-6, AC-14: generated weeks.

describe('generated weeks (AC-6, AC-14): no in-order step is lost, the order holds, the rest gap holds, no day gets longer', () => {
  let seed = 20261010;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  // In-order kinds are listed twice so reorders come up often.
  const KINDS = ['practice', 'drafting', 'review', 'lesson', 'lesson', 'heavy', 'strength', 'strength', 'general', 'fixed_time_session'] as const;
  const IN_ORDER = ['lesson', 'strength'];

  const dateOfTag = (tag: string) => dateOf(Number(tag[0]), NAMES.indexOf(tag.slice(2) as Name));

  /** A random practice day's steps (`tag` is the day's id); in-order steps are numbered in written order by `sequence`. */
  function practiceSteps(tag: string, sequence: Record<string, number>, options: { swaps: boolean }): CarriedStep[] {
    const count = 1 + Math.floor(random() * 4);
    const used = new Set<string>();
    const steps: CarriedStep[] = [];
    for (let i = 0; i < count; i++) {
      let k: string = pick(KINDS);
      if (IN_ORDER.includes(k) && used.has(k)) k = 'general';
      used.add(k);
      const title = IN_ORDER.includes(k) ? `${k} #${++sequence[k]}` : `${tag} ${k} ${i}`;
      // A few steps are flagged high-load whatever their kind (MR-11, RULE-7).
      const extra: Partial<CarriedStep> = random() < 0.03 ? { highLoad: true } : {};
      // A few steps carry a swap marker (ND-18) that must survive every plan. It names the step's own day, so the
      // written numbering stays true (a real swap names the day the step was written on).
      if (options.swaps && random() < 0.05) extra.swappedFrom = { taskId: tag, date: dateOfTag(tag) };
      // Sessions of one in-order kind are mostly the same length, as in written weeks; a few are not.
      const minutes = IN_ORDER.includes(k) && random() < 0.9 ? 15 : 5 * (1 + Math.floor(random() * 5));
      steps.push(step(title, i + 1, minutes, k, extra));
    }
    // Shuffle priorities: the written order stays, so in-order numbering is by day, not by priority.
    const priorities = steps.map((_, i) => i + 1).sort(() => random() - 0.5);
    steps.forEach((s, i) => {
      s.priority = priorities[i];
    });
    return steps;
  }

  /** A random two-week goal: every step tagged; days before today are done or missed, with breaks now and then. */
  function generate(goal: CarryInput['goal'] = CUSTOM, options: { breaks?: boolean } = {}) {
    const todayIndex = 7 + Math.floor(random() * 7);
    const today = dateOf(2, todayIndex - 7);
    const sequence: Record<string, number> = { lesson: 0, strength: 0 };
    const spec: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {};
    let breakLeft = 0;
    for (const week of [1, 2] as const) {
      NAMES.forEach((name, index) => {
        if (name === 'thu' || name === 'sun') return;
        const absolute = (week - 1) * 7 + index;
        const isTest = name === 'sat';
        let kind: DayKind;
        if (absolute < todayIndex) {
          if (options.breaks !== false && breakLeft === 0 && random() < 0.1) breakLeft = 3;
          kind = breakLeft > 0 ? 'missed' : random() < 0.5 ? 'missed' : 'done';
          if (breakLeft > 0) breakLeft -= 1;
        } else kind = random() < 0.1 ? 'done' : 'planned';
        if (isTest) {
          spec[`${week}-${name}`] = { kind, steps: [step(`Weekly test ${week}`, 1, 20, 'weekly_test', random() < 0.3 ? { highLoad: true } : {}), step('Compare', 2, 10, 'weekly_test')] };
          return;
        }
        const steps = practiceSteps(`${week}-${name}`, sequence, { swaps: true });
        spec[`${week}-${name}`] = { kind, steps, minutes: random() < 0.2 ? steps.reduce((sum, s) => sum + s.durationMinutes, 0) + 5 : undefined };
      });
    }
    return weeks(spec, { today, goal });
  }

  const sequenceOf = (title: string) => Number(/#(\d+)$/.exec(title)?.[1] ?? NaN);
  const counts = (dayKind: DayKind) => dayKind === 'done' || dayKind === 'planned';

  function check(input: CarryInput, plan: RecoveryPlan, profile: RecoveryProfile) {
    const original = new Map(input.tasks.map((t) => [t.id, t]));
    const kindOf = new Map(input.days.map((d) => [d.taskId, d]));
    const after = store(input, plan);
    const changed = new Set([
      ...plan.carries.map((c) => c.toTaskId),
      ...(plan.reorders ?? []).flatMap((r) => r.rows.map((row) => row.taskId)),
      ...(plan.continues ?? []).map((c) => c.toTaskId),
      ...(plan.easyStart ? [plan.easyStart.taskId] : []),
    ]);
    const isHard = (s: CarriedStep) => actionOf(s, profile)?.hard ?? false;
    const inOrder = [...inOrderMoveKinds(profile)];

    for (const taskId of changed) {
      const before = original.get(taskId)!;
      const now = after.tasks.find((t) => t.id === taskId)!;
      // Nothing on the test day or a rest day.
      expect(before.isTestDay || before.isRestDay).toBe(false);
      // No day longer than written.
      const sum = now.steps.reduce((total, s) => total + s.durationMinutes, 0);
      expect(sum).toBeLessThanOrEqual(before.steps.reduce((total, s) => total + s.durationMinutes, 0));
      expect(now.durationMinutes).toBeLessThanOrEqual(before.durationMinutes);
      // Never a day left with no steps.
      if (before.steps.length > 0) expect(now.steps.length, `${taskId} left empty`).toBeGreaterThan(0);
      // No fixed or continue-marked step replaced, and the minutes of every kept step unchanged.
      for (const s of before.steps) {
        if (actionOf(s, profile)?.action === 'fixed' || s.continueFrom) expect(now.steps.map((x) => x.title)).toContain(s.title);
      }
      // A missed day only ever gains next-week records.
      if (kindOf.get(taskId)!.kind === 'missed') expect(now.steps.map(({ toNextWeek: _t, ...rest }) => rest)).toEqual(before.steps.map(({ toNextWeek: _t, ...rest }) => rest));
    }
    for (const item of plan.continues ?? []) {
      expect(after.tasks.find((t) => t.id === item.toTaskId)!.steps.some((s) => s.continueFrom?.taskId === item.fromTaskId)).toBe(true);
    }

    // An ordinary carry never moves an in-order move step, nor a step that already moved (ND-13).
    for (const carry of plan.carries) {
      expect(inOrder).not.toContain(carry.step.kind);
      const source = original.get(carry.fromTaskId)!.steps.find((s) => s.title === carry.step.title)!;
      expect(source.carriedFrom ?? source.shiftedFrom).toBeUndefined();
    }

    // The rest gap (MR-29): no step placed in this plan that is hard has another hard step within the gap, on a day
    // that is done or open, unless both days already held a hard step that close. Never on the same day.
    const hardOf = (s: CarriedStep) => (actionOf(s, profile) ? isHard(s) : s.highLoad === true);
    const writtenHard = (taskId: string) => original.get(taskId)!.steps.some(hardOf);
    const placedNow = new Set<CarriedStep>();
    for (const t of after.tasks) {
      if (!changed.has(t.id)) continue;
      const titlesBefore = new Set(original.get(t.id)!.steps.map((s) => s.title));
      for (const s of t.steps) if (!titlesBefore.has(s.title)) placedNow.add(s);
    }
    const placed = after.tasks.flatMap((t) => t.steps.map((s) => ({ task: t, step: s })));
    for (const { task, step: moved } of placed) {
      if (!placedNow.has(moved) || !isHard(moved) || !counts(kindOf.get(task.id)!.kind)) continue;
      for (const { task: other, step: s } of placed) {
        if (s === moved || !counts(kindOf.get(other.id)!.kind)) continue;
        const distance = Math.abs(Date.parse(other.date) - Date.parse(task.date)) / 86_400_000;
        if (!hardOf(s)) continue;
        const wasThatClose = distance > 0 && writtenHard(task.id) && writtenHard(other.id);
        if (!wasThatClose) expect(distance, `${moved.title} on ${task.date} vs ${s.title} on ${other.date}`).toBeGreaterThan(profile.restGapDays);
      }
    }

    // RULE-20: every in-order step of a week is on a day of that week (done, missed or open) or listed for next week;
    // a step placed this run left no live copy behind on another open day; and the steps not done yet are in order.
    for (const k of inOrder) {
      for (const week of [1, 2]) {
        const written = new Set(input.tasks.filter((t) => t.weekNumber === week).flatMap((t) => t.steps.filter((s) => s.kind === k).map((s) => s.title)));
        for (const t of input.tasks.filter((x) => x.weekNumber === week)) for (const s of t.steps) for (const r of s.toNextWeek ?? []) if (r.step.kind === k) written.add(r.step.title);
        const reorder = (plan.reorders ?? []).find((r) => r.kind === k && r.weekNumber === week);
        const listed = (reorder?.toNextWeek ?? []).map((s) => s.title);
        const weekTasks = after.tasks.filter((t) => t.weekNumber === week);
        const onDays = new Set(weekTasks.flatMap((t) => t.steps.filter((s) => s.kind === k).map((s) => s.title)));
        for (const title of written) expect(onDays.has(title) || listed.includes(title), `${title} lost`).toBe(true);
        const open = weekTasks
          .filter((t) => kindOf.get(t.id)!.kind === 'planned' && t.date >= input.today)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .flatMap((t) => t.steps.filter((s) => s.kind === k).map((s) => s.title));
        expect(new Set(open).size, `${k} twice on open days`).toBe(open.length);
        for (const title of listed) expect(open, `${title} both listed and on a session`).not.toContain(title);
        if (reorder && !reorder.waits) {
          const notDone = [...open, ...listed].map(sequenceOf);
          expect(notDone, `${k} order in week ${week}`).toEqual([...notDone].sort((a, b) => a - b));
        }
      }
    }

    // Swap markers survive: every swapped step is still there with its marker, and the swapped days are the same.
    for (const t of input.tasks) {
      for (const s of t.steps) {
        if (s.swappedFrom) expect(after.tasks.find((x) => x.id === t.id)!.steps.some((x) => x.title === s.title && x.swappedFrom?.taskId === s.swappedFrom!.taskId)).toBe(true);
      }
    }
    expect(swappedTaskIds(after.tasks)).toEqual(swappedTaskIds(input.tasks));

    // The count is the listed steps of the week.
    for (const week of [1, 2]) {
      const listed = (plan.reorders ?? []).filter((r) => r.weekNumber === week).reduce((sum, r) => sum + r.toNextWeek.length, 0);
      expect(weekCounts(week, { tasks: countable(input), days: input.days, carry: plan }).toNextWeek).toBe(listed);
    }
  }

  it('2000 tagged two-week goals, planned and then replanned after the writes', () => {
    const totals = { reordered: 0, gaveUp: 0, hardPlaced: 0, listed: 0, waited: 0, hardMoves: 0, carries: 0, easy: 0 };
    for (let run = 0; run < 2000; run++) {
      const profile = profileWith(Math.floor(random() * 3));
      const input = generate();
      const plan = on(input, profile);
      check(input, plan, profile);
      for (const r of plan.reorders!) {
        totals.reordered += r.sessions.filter((s) => s.changed && s.holds).length;
        totals.gaveUp += r.sessions.filter((s) => !s.holds).length;
        totals.listed += r.toNextWeek.length;
        if (r.waits) totals.waited += 1;
        if (r.kind === 'strength') totals.hardPlaced += r.sessions.filter((s) => s.changed && s.holds).length;
      }
      totals.carries += plan.carries.length;
      totals.hardMoves += plan.carries.filter((c) => actionOf(c.step, profile)?.hard).length;
      if (plan.easyStart) totals.easy += 1;

      // A replan after the writes writes nothing new and still breaks nothing.
      const stored = store(input, plan);
      const again = on(stored, profile);
      check(stored, again, profile);
      const handled = new Set(plan.carries.map((c) => c.fromTaskId));
      expect(again.carries.filter((c) => handled.has(c.fromTaskId))).toEqual([]);
      expect(again.reorders!.flatMap((r) => r.rows)).toEqual([]);
      expect(again.continues).toEqual([]);
      expect(again.easyStart).toBeNull();
      // The same steps are listed for next week.
      expect(again.reorders!.map((r) => [r.weekNumber, r.kind, r.toNextWeek.map((s) => s.title)])).toEqual(plan.reorders!.map((r) => [r.weekNumber, r.kind, r.toNextWeek.map((s) => s.title)]));
    }
    // The generator exercises every path.
    expect(totals.reordered).toBeGreaterThan(200);
    expect(totals.gaveUp).toBeGreaterThan(50);
    expect(totals.hardPlaced).toBeGreaterThan(80);
    expect(totals.listed).toBeGreaterThan(2000);
    expect(totals.waited).toBeGreaterThan(30);
    expect(totals.hardMoves).toBeGreaterThan(10);
    expect(totals.carries).toBeGreaterThan(30);
    expect(totals.easy).toBeGreaterThan(100);
  });

  it('3500 two-week goals whose profile has no in-order move kinds: ordinary carries, hard ones included, keep every rule', () => {
    const totals = { hardMoves: 0, carries: 0 };
    for (let run = 0; run < 3500; run++) {
      const base = profileWith(Math.floor(random() * 3));
      const profile: RecoveryProfile = { ...base, kinds: base.kinds.map((k) => ({ ...k, inOrder: false })) };
      expect(inOrderMoveKinds(profile).size).toBe(0);
      // No breaks: a break carries nothing (ND-11), and this run is about ordinary carries.
      const input = generate(CUSTOM, { breaks: false });
      const plan = on(input, profile);
      expect(plan.reorders).toEqual([]);
      check(input, plan, profile);
      totals.carries += plan.carries.length;
      totals.hardMoves += plan.carries.filter((c) => actionOf(c.step, profile)?.hard).length;
      const stored = store(input, plan);
      const again = on(stored, profile);
      check(stored, again, profile);
      const handled = new Set(plan.carries.map((c) => c.fromTaskId));
      expect(again.carries.filter((c) => handled.has(c.fromTaskId))).toEqual([]);
      expect(again.continues).toEqual([]);
    }
    // Near M3.1b's 296 carries and 124 hard moves (2000 goals with in-order kinds then).
    expect(totals.carries).toBeGreaterThan(450);
    expect(totals.hardMoves).toBeGreaterThan(100);
  });

  it('300 weeks lived day by day (missed days, breaks, steps missed twice): what was done is in order, and done plus next week is every step', () => {
    let runs = 0;
    let missedTwice = 0;
    for (let run = 0; run < 300; run++) {
      const profile = profileWith(Math.floor(random() * 3));
      const sequence: Record<string, number> = { lesson: 0, strength: 0 };
      const spec: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {};
      // Last week was done; this week has up to six practice days and the test on Saturday.
      for (const name of NAMES) {
        if (name === 'sat') continue;
        const isRest = (name === 'thu' || name === 'sun') && random() < 0.5;
        spec[`2-${name}`] = isRest ? { rest: true, steps: [] } : { rest: false, steps: practiceSteps(`2-${name}`, sequence, { swaps: false }) };
      }
      let input = weeks(spec, { today: dateOf(2, 0) });
      input = { ...input, days: input.days.map((d) => (d.weekNumber === 1 && d.kind !== 'rest' ? { ...d, kind: 'done' as const } : d)) };
      const written = input.tasks.filter((t) => t.weekNumber === 2).flatMap((t) => t.steps.filter((s) => IN_ORDER.includes(s.kind as string)));

      let breakLeft = 0;
      for (let index = 0; index <= 7; index++) {
        const today = dateOf(2, index);
        input = { ...input, today, gap: findOpenGap(input.days) };
        const plan = on(input, profile);
        check(input, plan, profile);
        input = store(input, plan);
        const again = on(input, profile);
        expect(again.reorders!.flatMap((r) => r.rows)).toEqual([]);
        expect(again.easyStart).toBeNull();
        if (index === 7) break;
        // Today happens or not; now and then a break of three days.
        const todayTask = input.days.find((d) => d.date === today)!;
        if (todayTask.kind === 'rest') continue;
        if (breakLeft === 0 && random() < 0.08) breakLeft = 3;
        const outcome: DayKind = breakLeft > 0 || random() < 0.35 ? 'missed' : 'done';
        if (breakLeft > 0) breakLeft -= 1;
        if (outcome === 'missed' && todayTask.isTestDay === false && input.tasks.find((t) => t.id === todayTask.taskId)!.steps.some((s) => s.shiftedFrom)) missedTwice += 1;
        input = { ...input, days: input.days.map((d) => (d.taskId === todayTask.taskId ? { ...d, kind: outcome } : d)) };
      }

      // The week is over: the in-order steps done this week are in order, and done plus listed is every step, once.
      const queue = inOrderQueue({ ...input, profile });
      for (const k of IN_ORDER) {
        const done = input.tasks
          .filter((t) => t.weekNumber === 2 && input.days.find((d) => d.taskId === t.id)!.kind === 'done')
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .flatMap((t) => t.steps.filter((s) => s.kind === k).map((s) => sequenceOf(s.title)));
        expect(done, `${k} done in order`).toEqual([...done].sort((a, b) => a - b));
        const left = (queue.find((q) => q.weekNumber === 2 && q.kind === k)?.steps ?? []).map((s) => sequenceOf(s.title));
        expect(left, `${k} not done, in order`).toEqual([...left].sort((a, b) => a - b));
        expect([...done, ...left].sort((a, b) => a - b)).toEqual(written.filter((s) => s.kind === k).map((s) => sequenceOf(s.title)));
      }
      runs += 1;
    }
    expect(runs).toBe(300);
    expect(missedTwice).toBeGreaterThan(70);
  });

  it('run10k weeks written before kinds: missed sessions\' plan, untagged steps drop as high_load (RULE-18)', () => {
    let highLoad = 0;
    for (let run = 0; run < 100; run++) {
      const tagged = generate(RUN10K);
      const input = { ...tagged, tasks: tagged.tasks.map((t) => ({ ...t, steps: t.steps.map(({ kind: _k, ...rest }) => rest as CarriedStep) })) };
      const plan = on(input, profileWith(Math.floor(random() * 3)));
      const legacy = planCarries(input);
      expect({ carries: plan.carries, drops: plan.drops, held: plan.held, alreadyCarried: plan.alreadyCarried }).toEqual(legacy);
      expect(plan.carries).toEqual([]);
      expect(plan.reorders).toEqual([]);
      expect(plan.easyStart).toBeNull();
      highLoad += plan.drops.filter((d) => d.reason === 'high_load').length;
    }
    expect(highLoad).toBeGreaterThan(20);
  });
});
