import { describe, it, expect } from 'vitest';
import { planCarries, swappedTaskIds, type CarriedStep, type CarryInput, type CarryTask } from '../src/lib/carryForward.js';
import { findOpenGap, type DayClassification, type DayKind } from '../src/lib/missedSessions.js';
import { weekCounts } from '../src/lib/missedSignals.js';
import { MOVED_WARM_UP_LINE, planRecovery, takePlace, type RecoveryPlan } from '../src/lib/recovery/carry.js';
import { actionOf, profileFailures, withFixedKinds, type RecoveryKind, type RecoveryProfile } from '../src/lib/recovery/profile.js';

// Method-aware recovery M3.1b: the rest gap (RULE-14) and the order shift (RULE-13) in the carry planner, the
// pushed-out count (RULE-17), and generated weeks (AC-6). Pure: the one-transaction write is in methodReconcile.test.ts.

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
        isKeySession: false,
        isTestDay,
        durationMinutes: s.minutes ?? steps.reduce((sum, x) => sum + x.durationMinutes, 0),
        steps,
      });
      days.push({ taskId: key, date, weekNumber: week, dayNumber: index + 1, isKeySession: false, isTestDay, kind: dayKind });
    });
  }
  return { days, gap: findOpenGap(days), tasks, goal: options.goal ?? CUSTOM, today: options.today, timezone: 'UTC', sleepTime: '23:00' };
}

const on = (input: CarryInput, profile: RecoveryProfile | null = PROFILE) => planRecovery({ ...input, method: { profile } });
const dropOf = (plan: RecoveryPlan, taskId: string) => plan.drops.find((d) => d.taskId === taskId)?.reason;
const outcomeOf = (plan: RecoveryPlan, taskId: string) => plan.outcomes!.find((o) => o.taskId === taskId);
const rowOf = (plan: RecoveryPlan, taskId: string) =>
  plan.carries.find((c) => c.toTaskId === taskId)?.steps ?? plan.shifts!.flatMap((s) => s.rows).find((r) => r.taskId === taskId)?.steps;
const countable = (input: CarryInput) => input.tasks.map((t) => ({ id: t.id, weekNumber: t.weekNumber, isRestDay: t.isRestDay, isKeySession: t.isKeySession }));

/** Writes every planned row back into the input, as reconcile does with the carry switch on. */
function store(input: CarryInput, plan: RecoveryPlan): CarryInput {
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of plan.carries) rows.set(carry.toTaskId, carry);
  for (const shift of plan.shifts ?? []) for (const row of shift.rows) rows.set(row.taskId, row);
  for (const item of plan.continues ?? []) if (!rows.has(item.toTaskId)) rows.set(item.toTaskId, item);
  return {
    ...input,
    tasks: input.tasks.map((task) => (rows.has(task.id) ? { ...task, steps: rows.get(task.id)!.steps, durationMinutes: rows.get(task.id)!.durationMinutes } : task)),
  };
}

describe('the M3.1b test profiles', () => {
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

describe('RULE-13 the order shift', () => {
  /** Lessons on Mon (3, missed), Tue (4), Wed (5) and Fri (6); today is Tue. */
  const lessonWeek = (over: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {}) =>
    weeks(
      {
        '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') },
        '2-tue': { steps: day('Lesson 4', 'lesson') },
        '2-wed': { steps: day('Lesson 5', 'lesson') },
        '2-fri': { steps: day('Lesson 6', 'lesson') },
        ...over,
      },
      { today: '2026-09-22' }
    );

  it('Lesson 3 takes Lesson 4\'s place, each later lesson moves one session on, and the last one is pushed out and counted', () => {
    const input = lessonWeek();
    const plan = on(input);

    expect(plan.carries).toHaveLength(1);
    const carry = plan.carries[0];
    expect(carry).toMatchObject({ fromTaskId: '2-mon', toTaskId: '2-tue', durationMinutes: 30 });
    expect(carry.steps.map((s) => s.title)).toEqual(['Lesson 3', 'Lesson 4 review', 'Lesson 4 extra']);
    expect(carry.step).toMatchObject({ title: 'Lesson 3', priority: 1, stepNumber: 1, durationMinutes: 15 });
    expect(carry.step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo Lesson 3.`);
    expect(carry.step.carriedFrom).toMatchObject({ taskId: '2-mon', date: '2026-09-21' });
    expect(carry.step.carriedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson 4']);
    expect(carry.step.carriedFrom!.pushedOut).toMatchObject({ title: 'Lesson 6', kind: 'lesson' });
    expect(carry.step.carriedFrom!.pushedOut).not.toHaveProperty('shiftedFrom');

    const wed = rowOf(plan, '2-wed')!;
    expect(wed.map((s) => s.title)).toEqual(['Lesson 4', 'Lesson 5 review', 'Lesson 5 extra']);
    expect(wed[0]).toMatchObject({ priority: 1, instructions: 'Do Lesson 4.', shiftedFrom: { taskId: '2-tue', date: '2026-09-22' } });
    expect(wed[0].shiftedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson 5']);
    const fri = rowOf(plan, '2-fri')!;
    expect(fri.map((s) => s.title)).toEqual(['Lesson 5', 'Lesson 6 review', 'Lesson 6 extra']);
    expect(fri[0]).toMatchObject({ instructions: 'Do Lesson 5.', shiftedFrom: { taskId: '2-wed', date: '2026-09-23' } });

    expect(plan.shifts).toEqual([
      {
        missedTaskId: '2-mon',
        missedDate: '2026-09-21',
        kind: 'lesson',
        receivingTaskId: '2-tue',
        steps: [
          { fromTaskId: '2-tue', fromDate: '2026-09-22', toTaskId: '2-wed', toDate: '2026-09-23', kind: 'lesson', stepTitle: 'Lesson 4' },
          { fromTaskId: '2-wed', fromDate: '2026-09-23', toTaskId: '2-fri', toDate: '2026-09-25', kind: 'lesson', stepTitle: 'Lesson 5' },
          { fromTaskId: '2-fri', fromDate: '2026-09-25', toTaskId: null, toDate: null, kind: 'lesson', stepTitle: 'Lesson 6' },
        ],
        rows: [
          { taskId: '2-wed', steps: wed, durationMinutes: 30 },
          { taskId: '2-fri', steps: fri, durationMinutes: 30 },
        ],
      },
    ]);
    expect(plan.drops).toEqual([]);
    expect(outcomeOf(plan, '2-mon')).toEqual({ taskId: '2-mon', date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' });
    expect(weekCounts(2, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ pushedOut: 1, noRoom: 0, letGo: 0, continued: 0 });
    // Last week's count is its own.
    expect(weekCounts(1, { tasks: countable(input), days: input.days, carry: plan })).toMatchObject({ pushedOut: 0 });
  });

  it('a second run plans no new shift; the stored carry still counts the pushed-out step once', () => {
    const input = lessonWeek();
    const stored = store(input, on(input));
    const again = on(stored);
    expect(again.carries).toEqual([]);
    expect(again.shifts).toEqual([]);
    expect(again.drops).toEqual([]);
    expect(again.alreadyCarried.map((c) => c.toTaskId)).toEqual(['2-tue']);
    expect(outcomeOf(again, '2-mon')).toMatchObject({ outcome: 'moved' });
    expect(weekCounts(2, { tasks: countable(stored), days: stored.days, carry: again })).toMatchObject({ pushedOut: 1 });
  });

  it('a shifted step is never carried or shifted again', () => {
    // After the shift is stored, Wed (holding Lesson 4, shifted) is missed too.
    const input = lessonWeek();
    const stored = store(input, on(input));
    const later = {
      ...stored,
      today: '2026-09-24',
      days: stored.days.map((d) => (d.taskId === '2-tue' ? { ...d, kind: 'done' as const } : d.taskId === '2-wed' ? { ...d, kind: 'missed' as const } : d)),
    };
    const plan = on(later);
    expect(plan.carries.map((c) => c.step.title)).not.toContain('Lesson 4');
    expect(plan.shifts).toEqual([]);
    // Its own let-go review is the top step left, so the day is let go.
    expect(outcomeOf(plan, '2-wed')).toMatchObject({ rules: 'method', outcome: 'let_go' });
  });

  it('lands before the next lesson as an ordinary carry when a day before it fits', () => {
    const plan = on(lessonWeek({ '2-tue': { steps: day('tue practice', 'practice') } }));
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['Lesson 3', '2-tue']]);
    expect(plan.shifts).toEqual([]);
    expect(plan.carries[0].step.carriedFrom).not.toHaveProperty('pushedOut');
  });

  it('never lands after the next lesson: when its day cannot take it, no room', () => {
    // Tue holds Lesson 4 but is done.
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { kind: 'done', steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-23' }));
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('receiving_day_done');
  });

  it('when the next lesson is the last this week, it is pushed out directly', () => {
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-wed': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22' }));
    // Tue has no lesson and fits, so it lands there first; take Tue away to force the take-over.
    expect(plan.carries[0].toTaskId).toBe('2-tue');
    const forced = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22' }));
    expect(forced.carries[0].step.carriedFrom!.pushedOut).toMatchObject({ title: 'Lesson 4' });
    expect(forced.shifts![0].steps).toEqual([{ fromTaskId: '2-tue', fromDate: '2026-09-22', toTaskId: null, toDate: null, kind: 'lesson', stepTitle: 'Lesson 4' }]);
    expect(forced.shifts![0].rows).toEqual([]);
  });

  it.each([
    ['a later lesson day is done', { '2-wed': { kind: 'done' as const, steps: day('Lesson 5', 'lesson') } }],
    ['a later lesson day already holds a carry', { '2-wed': { steps: [...day('Lesson 5', 'lesson').slice(0, 2), step('old', 3, 5, 'general', { carriedFrom: { taskId: 'x', date: '2026-09-14', replaced: [] } })] } }],
    ['a later lesson does not fit (longer, and the rest of its day cannot be trimmed)', { '2-wed': { steps: [step('Lesson 5', 1, 5, 'lesson'), step('Group class', 2, 25, 'fixed_time_session')] } }],
    ['the next lesson is continue-marked', { '2-tue': { steps: day('Lesson 4', 'lesson', { continueFrom: { taskId: 'x', date: '2026-09-14' } }) } }],
  ])('a shift that fails on one link changes nothing: %s', (_name, over) => {
    const plan = on(lessonWeek(over));
    expect(plan.carries).toEqual([]);
    expect(plan.shifts).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'no_room', topStep: 'no_room' });
  });

  it('a longer step trims the lowest-priority steps of its new day, never a fixed one, and the day never gets longer', () => {
    const plan = on(lessonWeek({ '2-wed': { steps: [step('Lesson 5', 1, 10, 'lesson'), step('Group class', 2, 10, 'fixed_time_session'), step('wed review', 3, 10, 'review')] } }));
    const wed = rowOf(plan, '2-wed')!;
    expect(wed.map((s) => [s.title, s.priority])).toEqual([
      ['Lesson 4', 1],
      ['Group class', 2],
    ]);
    expect(wed[0].shiftedFrom!.replaced.map((s) => s.title)).toEqual(['Lesson 5', 'wed review']);
    expect(plan.shifts![0].rows.find((r) => r.taskId === '2-wed')!.durationMinutes).toBe(25);
  });

  it('a continue marker on a shifted day stays on its step', () => {
    const wed = [...day('Lesson 5', 'lesson').slice(0, 2), step('wed drafting', 3, 5, 'drafting', { continueFrom: { taskId: '2-mon', date: '2026-09-21' } })];
    const plan = on(lessonWeek({ '2-wed': { steps: wed } }));
    expect(rowOf(plan, '2-wed')!.find((s) => s.title === 'wed drafting')!.continueFrom).toEqual({ taskId: '2-mon', date: '2026-09-21' });
  });

  it('MR-29: Mon/Wed/Fri strength with a gap of 2, Mon missed: the shift keeps the written slots, so it goes through', () => {
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: day('Strength A', 'strength') },
        '2-wed': { steps: day('Strength B', 'strength') },
        '2-fri': { steps: day('Strength C', 'strength') },
      },
      { today: '2026-09-22' }
    );
    const plan = on(input, profileWith(2));
    // Tue (no hard step, 1 day before Wed's strength) fails the gap; Wed is the next strength day.
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['Strength A', '2-wed']]);
    expect(plan.shifts![0].steps.map((s) => [s.stepTitle, s.toTaskId])).toEqual([
      ['Strength B', '2-fri'],
      ['Strength C', null],
    ]);
    expect(rowOf(plan, '2-wed')![0].title).toBe('Strength A');
    expect(rowOf(plan, '2-fri')![0].title).toBe('Strength B');
    expect(plan.carries[0].step.carriedFrom!.pushedOut).toMatchObject({ title: 'Strength C' });
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'moved' });
  });

  it('MR-29: a hard step landing on a day that had no hard step, within the gap, still blocks the shift (MR-18)', () => {
    // Lesson 3 is high-load (hard); Tue's Lesson 4 is not, and Wed holds intervals a day later.
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson', { highLoad: true }) },
        '2-tue': { steps: day('Lesson 4', 'lesson') },
        '2-wed': { steps: day('intervals', 'heavy') },
        '2-fri': { steps: day('Lesson 5', 'lesson') },
      },
      { today: '2026-09-22' }
    );
    const plan = on(input);
    expect(plan.carries).toEqual([]);
    expect(plan.shifts).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(outcomeOf(plan, '2-mon')).toMatchObject({ outcome: 'no_room' });
    // Without the intervals day, the same shift goes through.
    const free = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson', { highLoad: true }) }, '2-tue': { steps: day('Lesson 4', 'lesson') }, '2-fri': { steps: day('Lesson 5', 'lesson') } }, { today: '2026-09-22' }));
    expect(free.carries.map((c) => c.toTaskId)).toEqual(['2-tue']);
  });

  it('MR-29: a shifted hard step still never shares a day with a hard step that stays there', () => {
    const wed = [step('Strength B', 1, 15, 'strength'), step('wed intervals', 2, 15, 'heavy')];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Strength A', 'strength') }, '2-wed': { steps: wed }, '2-fri': { steps: day('Strength C', 'strength') } }, { today: '2026-09-22' }));
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(plan.shifts).toEqual([]);
  });
});

describe('M3.1b review: swap markers survive (ND-18)', () => {
  const SWAP = { taskId: '1-fri', date: '2026-09-18' };

  it('a lesson holding swappedFrom on the next-of-kind day blocks the shift', () => {
    const input = weeks(
      {
        '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') },
        '2-tue': { steps: day('Lesson 4', 'lesson', { swappedFrom: SWAP }) },
        '2-wed': { steps: day('Lesson 5', 'lesson') },
      },
      { today: '2026-09-22' }
    );
    const plan = on(input);
    expect(plan.carries).toEqual([]);
    expect(plan.shifts).toEqual([]);
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(swappedTaskIds(store(input, plan).tasks)).toEqual(swappedTaskIds(input.tasks));
  });

  it('a swapped step is never trimmed by a carry: the search moves on', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('swapped review', 2, 15, 'review', { swappedFrom: SWAP })];
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('mon drill', 'practice') }, '2-tue': { steps: tue } }, { today: '2026-09-22' });
    const plan = on(input);
    expect(plan.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon drill', '2-wed']]);
    const after = store(input, plan);
    expect(after.tasks.find((t) => t.id === '2-tue')!.steps).toEqual(tue);
    expect(swappedTaskIds(after.tasks)).toEqual(swappedTaskIds(input.tasks));
  });

  it('a swapped step is never trimmed by a shift', () => {
    const wed = [step('Lesson 5', 1, 5, 'lesson'), step('swapped review', 2, 25, 'review', { swappedFrom: SWAP })];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') }, '2-wed': { steps: wed } }, { today: '2026-09-22' }));
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(plan.shifts).toEqual([]);
  });
});

describe('M3.1b review: a carry or shift never trims an in-order step', () => {
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

  it('a shift never trims a step of another in-order kind', () => {
    const wed = [step('Lesson 5', 1, 5, 'lesson'), step('Strength B', 2, 25, 'strength')];
    const plan = on(weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') }, '2-wed': { steps: wed } }, { today: '2026-09-22' }));
    expect(dropOf(plan, '2-mon')).toBe('shift_blocked');
    expect(plan.shifts).toEqual([]);
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

describe('RULE-18 with M3.1b: switch off, no profile, or untagged steps give exactly today\'s plan', () => {
  it('a lesson week without the switch, or with no profile, or untagged, is missed sessions\' plan', () => {
    const input = weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22' });
    expect(planRecovery(input)).toEqual(planCarries(input));
    const { continues: _c, alreadyContinued: _a, outcomes: _o, shifts, ...rest } = on(input, null);
    expect(rest).toEqual(planCarries(input));
    expect(shifts).toEqual([]);
    const untagged = weeks({ '2-mon': { kind: 'missed', steps: day('Lesson 3', 'lesson') }, '2-tue': { steps: day('Lesson 4', 'lesson') } }, { today: '2026-09-22', untagged: true });
    const plan = on(untagged);
    expect({ carries: plan.carries, drops: plan.drops, held: plan.held, alreadyCarried: plan.alreadyCarried }).toEqual(planCarries(untagged));
    expect(plan.shifts).toEqual([]);
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
// AC-6: generated weeks.

describe('generated weeks (AC-6): no carry or shift breaks the order or the rest gap, and no day gets longer', () => {
  let seed = 20261010;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  // In-order kinds are listed twice so shifts come up often.
  const KINDS = ['practice', 'drafting', 'review', 'lesson', 'lesson', 'heavy', 'strength', 'strength', 'general', 'fixed_time_session'] as const;
  const IN_ORDER = ['lesson', 'strength'];

  /** A random two-week goal: every step tagged; in-order steps are numbered in written order. */
  function generate(goal: CarryInput['goal'] = CUSTOM) {
    const todayIndex = 7 + Math.floor(random() * 7);
    const today = dateOf(2, todayIndex - 7);
    const sequence: Record<string, number> = { lesson: 0, strength: 0 };
    const spec: Partial<Record<`${1 | 2}-${Name}`, DaySpec>> = {};
    for (const week of [1, 2] as const) {
      NAMES.forEach((name, index) => {
        if (name === 'thu' || name === 'sun') return;
        const absolute = (week - 1) * 7 + index;
        const isTest = name === 'sat';
        let kind: DayKind;
        if (absolute < todayIndex) kind = random() < 0.5 ? 'missed' : 'done';
        else kind = random() < 0.1 ? 'done' : 'planned';
        if (isTest) {
          spec[`${week}-${name}`] = { kind, steps: [step(`Weekly test ${week}`, 1, 20, 'weekly_test', random() < 0.3 ? { highLoad: true } : {}), step('Compare', 2, 10, 'weekly_test')] };
          return;
        }
        const count = 1 + Math.floor(random() * 4);
        const used = new Set<string>();
        const steps: CarriedStep[] = [];
        for (let i = 0; i < count; i++) {
          let k: string = pick(KINDS);
          if (IN_ORDER.includes(k) && used.has(k)) k = 'general';
          used.add(k);
          const title = IN_ORDER.includes(k) ? `${k} #${++sequence[k]}` : `${week}-${name} ${k} ${i}`;
          // A few steps are flagged high-load whatever their kind (MR-11, RULE-7).
          const extra: Partial<CarriedStep> = random() < 0.03 ? { highLoad: true } : {};
          // A few steps landed by an earlier swap (ND-18); the marker must survive every plan.
          if (random() < 0.05) extra.swappedFrom = { taskId: `${week}-${pick(['mon', 'tue', 'wed', 'fri'] as const)}`, date: dateOf(week, 0) };
          // Sessions of one in-order kind are mostly the same length, as in written weeks; a few are not.
          const minutes = IN_ORDER.includes(k) && random() < 0.9 ? 15 : 5 * (1 + Math.floor(random() * 5));
          steps.push(step(title, i + 1, minutes, k, extra));
        }
        // Shuffle priorities: the written order stays, so in-order numbering is by day, not by priority.
        const priorities = steps.map((_, i) => i + 1).sort(() => random() - 0.5);
        steps.forEach((s, i) => {
          s.priority = priorities[i];
        });
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
    const changed = new Set([...plan.carries.map((c) => c.toTaskId), ...(plan.shifts ?? []).flatMap((s) => s.rows.map((r) => r.taskId)), ...(plan.continues ?? []).map((c) => c.toTaskId)]);
    const isHard = (s: CarriedStep) => actionOf(s, profile)?.hard ?? false;

    for (const taskId of changed) {
      const before = original.get(taskId)!;
      const now = after.tasks.find((t) => t.id === taskId)!;
      // Nothing on the test day or a rest day.
      expect(before.isTestDay || before.isRestDay).toBe(false);
      // No day longer than written.
      const sum = now.steps.reduce((total, s) => total + s.durationMinutes, 0);
      expect(sum).toBeLessThanOrEqual(before.steps.reduce((total, s) => total + s.durationMinutes, 0));
      expect(now.durationMinutes).toBeLessThanOrEqual(before.durationMinutes);
      // No fixed or continue-marked step replaced.
      for (const s of before.steps) {
        if (actionOf(s, profile)?.action === 'fixed' || s.continueFrom) expect(now.steps.map((x) => x.title)).toContain(s.title);
      }
    }
    for (const item of plan.continues ?? []) {
      expect(after.tasks.find((t) => t.id === item.toTaskId)!.steps.some((s) => s.continueFrom?.taskId === item.fromTaskId)).toBe(true);
    }

    // Nothing carried or shifted twice: every moved step came from a step without a move marker.
    for (const carry of plan.carries) {
      const source = original.get(carry.fromTaskId)!.steps.find((s) => s.title === carry.step.title)!;
      expect(source.carriedFrom ?? source.shiftedFrom).toBeUndefined();
    }
    for (const shift of plan.shifts ?? []) {
      for (const moved of shift.steps) {
        const source = original.get(moved.fromTaskId)!.steps.find((s) => s.title === moved.stepTitle)!;
        expect(source.carriedFrom ?? source.shiftedFrom).toBeUndefined();
        if (moved.toTaskId) expect(original.get(moved.toTaskId)!.isTestDay).toBe(false);
      }
    }

    // The rest gap (MR-29): no moved hard step has another hard step within the gap, on a day that is done or open,
    // unless both days already held a hard step that close in the week as written. Never on the same day.
    const hardOf = (s: CarriedStep) => (actionOf(s, profile) ? isHard(s) : s.highLoad === true);
    const writtenHard = (taskId: string) => original.get(taskId)!.steps.some(hardOf);
    const movedNow = (s: CarriedStep) =>
      (s.carriedFrom && plan.carries.some((c) => c.fromTaskId === s.carriedFrom!.taskId && c.step.title === s.title)) ||
      (s.shiftedFrom && (plan.shifts ?? []).some((sh) => sh.steps.some((m) => m.stepTitle === s.title)));
    const placed = after.tasks.flatMap((t) => t.steps.map((s) => ({ task: t, step: s })));
    for (const { task, step: moved } of placed) {
      if (!movedNow(moved) || !isHard(moved) || !counts(kindOf.get(task.id)!.kind)) continue;
      for (const { task: other, step: s } of placed) {
        if (s === moved || !counts(kindOf.get(other.id)!.kind)) continue;
        const distance = Math.abs(Date.parse(other.date) - Date.parse(task.date)) / 86_400_000;
        if (!hardOf(s)) continue;
        const wasThatClose = distance > 0 && writtenHard(task.id) && writtenHard(other.id);
        if (!wasThatClose) expect(distance, `${moved.title} on ${task.date} vs ${s.title} on ${other.date}`).toBeGreaterThan(profile.restGapDays);
      }
    }

    // Every in-order kind still in order, on the days that are done or open.
    for (const k of IN_ORDER) {
      const seen = after.tasks
        .filter((t) => counts(kindOf.get(t.id)!.kind))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .flatMap((t) => t.steps.filter((s) => s.kind === k).map((s) => sequenceOf(s.title)));
      expect(seen, `${k} order`).toEqual([...seen].sort((a, b) => a - b));
      expect(new Set(seen).size).toBe(seen.length);
    }

    // No in-order step ever disappears, unless it is the one pushed past the week.
    const pushed = new Set((plan.shifts ?? []).flatMap((sh) => sh.steps.filter((m) => m.toTaskId === null).map((m) => m.stepTitle)));
    const titlesAfter = new Set(after.tasks.flatMap((t) => t.steps.map((s) => s.title)));
    for (const t of input.tasks) {
      for (const s of t.steps) {
        if (IN_ORDER.includes(s.kind as string) && !pushed.has(s.title)) expect(titlesAfter.has(s.title), `${s.title} disappeared`).toBe(true);
      }
    }

    // Swap markers survive: every swapped step is still there with its marker, and the swapped days are the same.
    for (const t of input.tasks) {
      for (const s of t.steps) {
        if (s.swappedFrom) expect(after.tasks.find((x) => x.id === t.id)!.steps.some((x) => x.title === s.title && x.swappedFrom?.taskId === s.swappedFrom!.taskId)).toBe(true);
      }
    }
    expect(swappedTaskIds(after.tasks)).toEqual(swappedTaskIds(input.tasks));

    // The pushed-out count is one per shift.
    if ((plan.shifts ?? []).length > 0) {
      const total = [1, 2].reduce((sum, w) => sum + (weekCounts(w, { tasks: countable(input), days: input.days, carry: plan }).pushedOut ?? 0), 0);
      expect(total).toBe(plan.shifts!.length);
    }
  }

  it('2000 tagged two-week goals, planned and then replanned after the writes', () => {
    let shifts = 0;
    let hardShifts = 0;
    let hardMoves = 0;
    let carries = 0;
    for (let run = 0; run < 2000; run++) {
      const profile = profileWith(Math.floor(random() * 3));
      const input = generate();
      const plan = on(input, profile);
      check(input, plan, profile);
      shifts += plan.shifts!.length;
      hardShifts += plan.shifts!.filter((sh) => profile.kinds.find((k) => k.id === sh.kind)?.hard).length;
      carries += plan.carries.length;
      hardMoves += plan.carries.filter((c) => actionOf(c.step, profile)?.hard).length;

      // A replan after the writes plans no new carry or shift for a handled day, and still breaks nothing.
      const stored = store(input, plan);
      const again = on(stored, profile);
      check(stored, again, profile);
      const handled = new Set(plan.carries.map((c) => c.fromTaskId));
      expect(again.carries.filter((c) => handled.has(c.fromTaskId))).toEqual([]);
      expect(again.shifts!.filter((s) => handled.has(s.missedTaskId))).toEqual([]);
      expect(again.continues).toEqual([]);
    }
    // The generator exercises every path.
    expect(shifts).toBeGreaterThan(40);
    expect(hardShifts).toBeGreaterThan(25);
    expect(hardMoves).toBeGreaterThan(60);
    expect(carries).toBeGreaterThan(200);
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
      expect(plan.shifts).toEqual([]);
      highLoad += plan.drops.filter((d) => d.reason === 'high_load').length;
    }
    expect(highLoad).toBeGreaterThan(20);
  });
});
