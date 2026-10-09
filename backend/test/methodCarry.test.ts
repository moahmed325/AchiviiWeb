import { describe, it, expect } from 'vitest';
import { planCarries, type CarriedStep, type CarryInput, type CarryTask } from '../src/lib/carryForward.js';
import { findOpenGap, type DayClassification, type DayKind } from '../src/lib/missedSessions.js';
import { weekCounts } from '../src/lib/missedSignals.js';
import { MOVED_WARM_UP_LINE, planRecovery, withWarmUpLine, type RecoveryPlan } from '../src/lib/recovery/carry.js';
import { profileFailures, type RecoveryProfile } from '../src/lib/recovery/profile.js';
import { PROFILE } from './methodProfile.js';

// Method-aware recovery M3.1a: the carry planner follows each step's action (RULE-9 to RULE-12, RULE-17, RULE-18,
// MR-10, MR-12, MR-17, MR-26, MR-27). Pure: the reconcile wiring and the switch are in methodReconcile.test.ts.

const CUSTOM = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };

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

/** A 30-minute tagged practice day: practice 15 (move), review 10 (let go), general 5 (move). */
const tagged = (tag: string): CarriedStep[] => [
  step(`${tag} practice`, 1, 15, 'practice'),
  step(`${tag} review`, 2, 10, 'review'),
  step(`${tag} extra`, 3, 5, 'general'),
];
const untagged = (tag: string): CarriedStep[] => tagged(tag).map(({ kind: _k, ...rest }) => rest as CarriedStep);

/** Week from Monday 2026-09-21: Mon-Wed practice, Thu rest, Fri practice, Sat test, Sun rest. */
const DATES = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Name = (typeof NAMES)[number];

interface DaySpec {
  kind?: DayKind;
  key?: boolean;
  steps?: CarriedStep[];
  minutes?: number;
}

function week(
  spec: Partial<Record<Name, DaySpec>>,
  options: { today?: string; kinds?: boolean } = {}
): CarryInput {
  const tasks: CarryTask[] = [];
  const days: DayClassification[] = [];
  const withKinds = options.kinds !== false;
  NAMES.forEach((name, index) => {
    const isRestDay = name === 'thu' || name === 'sun';
    const isTestDay = name === 'sat';
    const s = spec[name] ?? {};
    const testSteps = [step('Warm up', 2, 5, 'weekly_test'), step('Weekly test: 1-minute test', 1, 15, 'weekly_test'), step('Compare', 3, 10, 'weekly_test')];
    const steps = s.steps ?? (isRestDay ? [] : isTestDay ? testSteps : withKinds ? tagged(name) : untagged(name));
    const id = `w1-${name}`;
    tasks.push({
      id,
      date: DATES[index],
      weekNumber: 1,
      dayNumber: index + 1,
      status: s.kind === 'done' ? 'completed' : 'pending',
      isRestDay,
      isKeySession: !!s.key,
      isTestDay,
      durationMinutes: s.minutes ?? steps.reduce((sum, x) => sum + x.durationMinutes, 0),
      steps,
    });
    days.push({ taskId: id, date: DATES[index], weekNumber: 1, dayNumber: index + 1, isKeySession: !!s.key, isTestDay, kind: isRestDay ? 'rest' : s.kind ?? 'planned' });
  });
  return { days, gap: findOpenGap(days), tasks, goal: CUSTOM, today: options.today ?? '2026-09-22', timezone: 'UTC', sleepTime: '23:00' };
}

const on = (input: CarryInput, profile: RecoveryProfile | null = PROFILE) => planRecovery({ ...input, method: { profile } });
const id = (name: Name) => `w1-${name}`;
const dropOf = (plan: RecoveryPlan, name: Name) => plan.drops.find((d) => d.taskId === id(name))?.reason;
const outcomeOf = (plan: RecoveryPlan, name: Name) => plan.outcomes!.find((o) => o.taskId === id(name));
const legacyFields = (plan: RecoveryPlan) => ({ carries: plan.carries, drops: plan.drops, held: plan.held, alreadyCarried: plan.alreadyCarried });

/** Writes every planned row back into the input, as reconcile does with the carry switch on. */
function store(input: CarryInput, plan: RecoveryPlan): CarryInput {
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of plan.carries) rows.set(carry.toTaskId, carry);
  for (const item of plan.continues ?? []) if (!rows.has(item.toTaskId)) rows.set(item.toTaskId, item);
  return {
    ...input,
    tasks: input.tasks.map((task) => (rows.has(task.id) ? { ...task, steps: rows.get(task.id)!.steps, durationMinutes: rows.get(task.id)!.durationMinutes } : task)),
  };
}

describe('the test profile', () => {
  it('passes the RULE-4 checks', () => {
    expect(profileFailures(PROFILE)).toEqual([]);
  });
});

describe('RULE-18: switch off, no profile, steps without kinds give exactly today\'s plan', () => {
  const scenarios: Array<[string, CarryInput]> = [
    ['carry onto the next day', week({ mon: { kind: 'missed' } })],
    ['the day before the test', week({ fri: { kind: 'missed' } }, { today: '2026-09-26' })],
    ['receiving day closed', week({ mon: { kind: 'missed' }, tue: { kind: 'missed' } }, { today: '2026-09-23' })],
    ['receiving day done', week({ mon: { kind: 'missed' }, tue: { kind: 'done' } }, { today: '2026-09-23' })],
    ['open gap', week({ mon: { kind: 'missed' }, tue: { kind: 'missed' }, wed: { kind: 'missed' } }, { today: '2026-09-25' })],
    ['key session held', week({ tue: { kind: 'missed', key: true } }, { today: '2026-09-23' })],
  ];

  it.each(scenarios)('%s: no method field gives planCarries itself', (_name, input) => {
    expect(planRecovery(input)).toEqual(planCarries(input));
    expect(planRecovery(input)).not.toHaveProperty('outcomes');
  });

  it.each(scenarios)('%s: a null profile gives the same carries, drops and holds, every day under missed sessions', (_name, input) => {
    const plan = on(input, null);
    expect(legacyFields(plan)).toEqual(planCarries(input));
    expect(plan.continues).toEqual([]);
    expect(plan.outcomes!.every((o) => o.rules === 'missed_sessions')).toBe(true);
  });

  it.each(scenarios)('%s: steps without kinds give the same plan with the profile', (_name, tagged) => {
    const input = { ...tagged, tasks: tagged.tasks.map((task) => ({ ...task, steps: task.steps.map(({ kind: _k, ...rest }) => rest as CarriedStep) })) };
    const plan = on(input);
    expect(legacyFields(plan)).toEqual(planCarries(input));
    expect(plan.outcomes!.every((o) => o.rules === 'missed_sessions')).toBe(true);
  });

  it('one step without a kind keeps the whole day on missed sessions\' rules', () => {
    const mon = tagged('mon');
    mon[2] = untagged('mon')[2];
    const input = week({ mon: { kind: 'missed', steps: mon } });
    const plan = on(input);
    expect(legacyFields(plan)).toEqual(planCarries(input));
    expect(outcomeOf(plan, 'mon')).toMatchObject({ rules: 'missed_sessions', outcome: 'moved' });
    expect(plan.carries[0].step.instructions).toBe('Do mon practice.');
  });

  it('generated weeks: untagged steps or no profile never change missed sessions\' plan', () => {
    let seed = 20261009;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let run = 0; run < 300; run++) {
      const spec: Partial<Record<Name, DaySpec>> = {};
      for (const name of NAMES) {
        const count = 2 + Math.floor(random() * 3);
        const order = Array.from({ length: count }, (_, i) => i + 1).sort(() => random() - 0.5);
        spec[name] = {
          key: random() < 0.2,
          kind: name === 'thu' || name === 'sun' ? undefined : (['missed', 'done', 'planned'] as DayKind[])[Math.floor(random() * 3)],
          steps: order.map((p, i) => step(`${name} ${i}`, p, 5 + Math.floor(random() * 4) * 5, undefined, random() < 0.2 ? { highLoad: true } : {})),
        };
      }
      const input = week(spec, { today: DATES[Math.floor(random() * 7)] });
      const legacy = planCarries(input);
      expect(planRecovery(input)).toEqual(legacy);
      expect(legacyFields(on(input))).toEqual(legacy);
      expect(legacyFields(on(input, null))).toEqual(legacy);
    }
  });
});

describe('RULE-9 move (AC-5)', () => {
  it('moves the highest-priority move step to the next practice day, with the warm-up line first and the same minutes', () => {
    const plan = on(week({ mon: { kind: 'missed' } }));
    expect(plan.carries).toHaveLength(1);
    const carry = plan.carries[0];
    expect(carry).toMatchObject({ fromTaskId: id('mon'), toTaskId: id('tue') });
    expect(carry.step).toMatchObject({ title: 'mon practice', durationMinutes: 15, kind: 'practice', carriedFrom: { taskId: id('mon'), date: '2026-09-21' } });
    expect(carry.step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo mon practice.`);
    expect(carry.step.instructions.split('\n')[0]).toBe(MOVED_WARM_UP_LINE);
    expect(carry.durationMinutes).toBeLessThanOrEqual(30);
    expect(outcomeOf(plan, 'mon')).toEqual({ taskId: id('mon'), date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' });
  });

  it('MR-26: the line is added once, even when the step moves again', () => {
    expect(withWarmUpLine(withWarmUpLine('Play scales.'))).toBe(`${MOVED_WARM_UP_LINE}\nPlay scales.`);
    expect(withWarmUpLine('')).toBe(MOVED_WARM_UP_LINE);
    // Mon's step was carried onto Tue; Tue is then missed and the carried step is its highest-priority move step.
    const first = on(week({ mon: { kind: 'missed' } }));
    const tueSteps = first.carries[0].steps.map((s) => (s.carriedFrom ? { ...s, priority: 1 } : s.title === 'tue practice' ? { ...s, priority: 2 } : s));
    const plan = on(week({ mon: { kind: 'missed' }, tue: { kind: 'missed', steps: tueSteps, minutes: first.carries[0].durationMinutes } }, { today: '2026-09-23' }));
    const again = plan.carries.find((c) => c.fromTaskId === id('tue'))!;
    expect(again.step.title).toBe('mon practice');
    expect(again.step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo mon practice.`);
    expect(again.step.durationMinutes).toBe(15);
  });

  it('MR-26: the steps left behind are not moved and not counted', () => {
    const mon = [step('mon warm-up', 1, 5, 'practice'), step('mon intervals', 2, 15, 'practice'), step('mon cool-down', 3, 5, 'practice')];
    const plan = on(week({ mon: { kind: 'missed', steps: mon } }));
    expect(plan.carries.map((c) => c.step.title)).toEqual(['mon warm-up']);
    const movedTitles = plan.carries.flatMap((c) => c.steps.map((s) => s.title));
    expect(movedTitles).not.toContain('mon intervals');
    expect(movedTitles).not.toContain('mon cool-down');
    expect(plan.drops).toEqual([]);
    expect(plan.outcomes).toEqual([{ taskId: id('mon'), date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' }]);
  });

  it('a fixed step is never moved: the highest-priority move step under it moves instead', () => {
    const mon = [step('Group run', 1, 15, 'fixed_time_session'), step('mon practice', 2, 10, 'practice'), step('mon review', 3, 5, 'review')];
    const plan = on(week({ mon: { kind: 'missed', steps: mon } }));
    expect(plan.carries.map((c) => c.step.title)).toEqual(['mon practice']);
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'moved', topStep: 'fixed' });
  });
});

describe('RULE-9 the receiving day search (MR-10, MR-17)', () => {
  it('skips a day whose only room is a fixed step, and the rest of that day stays as it is', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('Weekly class', 2, 15, 'fixed_time_session')];
    const plan = on(week({ mon: { kind: 'missed' }, tue: { steps: tue } }));
    expect(plan.carries.map((c) => c.toTaskId)).toEqual([id('wed')]);
  });

  it('skips a day whose only room is a step holding a continue marker', () => {
    const tue = [step('tue practice', 1, 15, 'practice'), step('tue drafting', 2, 15, 'drafting', { continueFrom: { taskId: 'earlier', date: '2026-09-20' } })];
    const plan = on(week({ mon: { kind: 'missed' }, tue: { steps: tue } }));
    expect(plan.carries.map((c) => c.toTaskId)).toEqual([id('wed')]);
    expect(plan.carries[0].replaced.map((s) => s.title)).toEqual(['wed review', 'wed extra']);
  });

  it('a fixed step on the receiving day is never replaced; other steps are', () => {
    const tue = [step('tue practice', 1, 10, 'practice'), step('Weekly class', 2, 10, 'fixed_time_session'), step('tue review', 3, 10, 'review')];
    const plan = on(week({ mon: { kind: 'missed', steps: [step('mon practice', 1, 10, 'practice')] }, tue: { steps: tue } }));
    expect(plan.carries[0]).toMatchObject({ toTaskId: id('tue') });
    expect(plan.carries[0].replaced.map((s) => s.title)).toEqual(['tue review']);
    expect(plan.carries[0].steps.map((s) => s.title)).toContain('Weekly class');
  });

  it('stops at a done day: no room, never a later day', () => {
    const plan = on(week({ mon: { kind: 'missed' }, tue: { kind: 'done' } }, { today: '2026-09-23' }));
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, 'mon')).toBe('receiving_day_done');
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'no_room', topStep: 'no_room' });
  });

  it('stops at a closed day (missed, or dated before today)', () => {
    const closed = on(week({ mon: { kind: 'missed' }, tue: { kind: 'missed' } }, { today: '2026-09-23' }));
    expect(dropOf(closed, 'mon')).toBe('receiving_day_closed');
    expect(closed.carries.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([[id('tue'), id('wed')]]);
    const past = on(week({ mon: { kind: 'missed' } }, { today: '2026-09-23' }));
    expect(dropOf(past, 'mon')).toBe('receiving_day_closed');
  });

  it('stops at a day that already holds a carry', () => {
    const tue = tagged('tue');
    tue[2] = { ...tue[2], carriedFrom: { taskId: 'elsewhere', date: '2026-09-20', replaced: [] } };
    const plan = on(week({ mon: { kind: 'missed' }, tue: { steps: tue } }));
    expect(dropOf(plan, 'mon')).toBe('receiving_day_taken');
  });

  it('never lands on the test day or a rest day; the day before the test has no room', () => {
    const plan = on(week({ fri: { kind: 'missed' } }, { today: '2026-09-26' }));
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, 'fri')).toBe('no_receiving_day');
    expect(on(week({ wed: { kind: 'missed' } }, { today: '2026-09-24' })).carries.map((c) => c.toTaskId)).toEqual([id('fri')]);
  });

  it('most recent wins when two missed days get the same receiving day (ND-12)', () => {
    // Tue has no room for Mon's step, so both Mon's and Tue's searches reach Wed.
    const tue = [step('tue practice', 1, 5, 'practice'), step('Weekly class', 2, 25, 'fixed_time_session')];
    const plan = on(week({ mon: { kind: 'missed' }, tue: { kind: 'missed', steps: tue } }, { today: '2026-09-23' }));
    expect(dropOf(plan, 'mon')).toBe('lost_to_later_miss');
    expect(plan.carries.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([[id('tue'), id('wed')]]);
  });

  it('is deterministic, and a stored carry is never planned again', () => {
    const input = week({ mon: { kind: 'missed' } });
    expect(on(input)).toEqual(on(input));
    const again = on(store(input, on(input)));
    expect(again.carries).toEqual([]);
    expect(again.alreadyCarried).toHaveLength(1);
    expect(outcomeOf(again, 'mon')).toMatchObject({ rules: 'method', outcome: 'moved' });
  });
});

describe('MR-27 until M3.1b', () => {
  it('a hard step that would move goes to no room', () => {
    const mon = [step('mon heavy', 1, 15, 'heavy'), step('mon review', 2, 15, 'review')];
    const plan = on(week({ mon: { kind: 'missed', steps: mon } }));
    expect(plan.carries).toEqual([]);
    expect(dropOf(plan, 'mon')).toBe('hard_waits');
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'no_room', topStep: 'no_room' });
  });

  it('a high-load step is hard whatever its kind, and a high-load continue step moves (MR-11), so it waits too', () => {
    const highLoad = on(week({ mon: { kind: 'missed', steps: [step('mon run', 1, 15, 'practice', { highLoad: true }), step('r', 2, 15, 'review')] } }));
    expect(dropOf(highLoad, 'mon')).toBe('hard_waits');
    const continueHigh = on(week({ mon: { kind: 'missed', steps: [step('mon draft', 1, 15, 'drafting', { highLoad: true }), step('r', 2, 15, 'review')] } }));
    expect(dropOf(continueHigh, 'mon')).toBe('hard_waits');
    expect(continueHigh.continues).toEqual([]);
  });

  it('an in-order step moves only to a day before the next step of its kind', () => {
    const lesson = (tag: string) => [step(`${tag} lesson`, 1, 15, 'lesson'), step(`${tag} review`, 2, 10, 'review'), step(`${tag} extra`, 3, 5, 'general')];
    const blocked = on(week({ mon: { kind: 'missed', steps: lesson('mon') }, tue: { steps: lesson('tue') } }));
    expect(blocked.carries).toEqual([]);
    expect(dropOf(blocked, 'mon')).toBe('out_of_order');
    expect(outcomeOf(blocked, 'mon')).toMatchObject({ outcome: 'no_room' });

    const allowed = on(week({ mon: { kind: 'missed', steps: lesson('mon') }, wed: { steps: lesson('wed') } }));
    expect(allowed.carries.map((c) => [c.step.title, c.toTaskId])).toEqual([['mon lesson', id('tue')]]);
  });
});

describe('RULE-10 continue (AC-5)', () => {
  const drafting = (tag: string) => [step(`${tag} drafting`, 1, 20, 'drafting'), step(`${tag} review`, 2, 10, 'review')];

  it('moves nothing and marks the next session this week with a step of that kind', () => {
    const input = week({ mon: { kind: 'missed', steps: drafting('mon') }, wed: { steps: drafting('wed') } });
    const plan = on(input);
    expect(plan.carries).toEqual([]);
    expect(plan.drops).toEqual([]);
    expect(plan.continues).toHaveLength(1);
    const item = plan.continues![0];
    expect(item).toMatchObject({ fromTaskId: id('mon'), fromDate: '2026-09-21', toTaskId: id('wed'), toDate: '2026-09-23', kind: 'drafting', stepTitle: 'wed drafting', durationMinutes: 30 });
    const original = input.tasks.find((t) => t.id === id('wed'))!.steps;
    expect(item.steps).toEqual([{ ...original[0], continueFrom: { taskId: id('mon'), date: '2026-09-21' } }, original[1]]);
    expect(outcomeOf(plan, 'mon')).toMatchObject({ rules: 'method', outcome: 'continued', topStep: 'continued' });
  });

  it('is written once: a stored marker is reported, never written again', () => {
    const input = week({ mon: { kind: 'missed', steps: drafting('mon') }, wed: { steps: drafting('wed') } });
    const after = store(input, on(input));
    const again = on(after);
    expect(again.continues).toEqual([]);
    expect(again.alreadyContinued).toEqual([
      { fromTaskId: id('mon'), fromDate: '2026-09-21', toTaskId: id('wed'), toDate: '2026-09-23', kind: 'drafting', stepTitle: 'wed drafting' },
    ]);
    expect(outcomeOf(again, 'mon')).toMatchObject({ outcome: 'continued' });
  });

  it('a carry never replaces the marked step, in the same run or later', () => {
    // Mon continues drafting onto Tue; Mon's move step also has to land on Tue, which only fits by replacing it.
    const mon = [step('mon drafting', 1, 10, 'drafting'), step('mon practice', 2, 10, 'practice')];
    const tue = [step('tue practice', 1, 20, 'practice'), step('tue drafting', 2, 10, 'drafting')];
    const input = week({ mon: { kind: 'missed', steps: mon }, tue: { steps: tue } });
    const plan = on(input);
    expect(plan.continues!.map((c) => c.toTaskId)).toEqual([id('tue')]);
    expect(plan.carries.map((c) => c.toTaskId)).toEqual([id('wed')]);
    const after = on(store(input, plan));
    expect(after.carries).toEqual([]);
  });

  it('a carry and a marker on the same day share one row', () => {
    const mon = [step('mon drafting', 1, 5, 'drafting'), step('mon practice', 2, 5, 'practice')];
    const plan = on(week({ mon: { kind: 'missed', steps: mon }, tue: { steps: [...tagged('tue'), step('tue drafting', 4, 5, 'drafting')], minutes: 35 } }));
    expect(plan.carries.map((c) => c.toTaskId)).toEqual([id('tue')]);
    expect(plan.continues!.map((c) => c.toTaskId)).toEqual([id('tue')]);
    expect(plan.continues![0].steps).toEqual(plan.carries[0].steps);
    expect(plan.carries[0].steps.find((s) => s.title === 'tue drafting')!.continueFrom).toEqual({ taskId: id('mon'), date: '2026-09-21' });
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'moved', topStep: 'continued' });
  });

  it('no later session with that kind this week is no room (MR-27)', () => {
    const plan = on(week({ mon: { kind: 'missed', steps: drafting('mon') } }));
    expect(plan.continues).toEqual([]);
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'no_room', topStep: 'no_room' });
  });

  it('a closed next session is no room, never a later one', () => {
    const done = on(week({ mon: { kind: 'missed', steps: drafting('mon') }, tue: { kind: 'done', steps: drafting('tue') }, wed: { steps: drafting('wed') } }, { today: '2026-09-23' }));
    expect(done.continues).toEqual([]);
    expect(outcomeOf(done, 'mon')).toMatchObject({ outcome: 'no_room' });

    // Mon's next drafting session (Tue) was missed too: Mon is no room; Tue's own marker goes to Wed.
    const missed = on(week({ mon: { kind: 'missed', steps: drafting('mon') }, tue: { kind: 'missed', steps: drafting('tue') }, wed: { steps: drafting('wed') } }, { today: '2026-09-23' }));
    expect(missed.continues!.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([[id('tue'), id('wed')]]);
    expect(outcomeOf(missed, 'mon')).toMatchObject({ outcome: 'no_room' });
    expect(outcomeOf(missed, 'tue')).toMatchObject({ outcome: 'continued' });
  });

  it('a step already marked by another day is no room for this one (written once)', () => {
    const wed = [{ ...drafting('wed')[0], continueFrom: { taskId: 'earlier', date: '2026-09-14' } }, drafting('wed')[1]];
    const plan = on(week({ mon: { kind: 'missed', steps: drafting('mon') }, wed: { steps: wed } }));
    expect(plan.continues).toEqual([]);
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'no_room' });
  });
});

describe('RULE-11 let go and RULE-12 fixed (AC-5)', () => {
  it('let go: nothing moves and nothing is added', () => {
    const plan = on(week({ mon: { kind: 'missed', steps: [step('mon review', 1, 20, 'review'), step('mon notes', 2, 10, 'review')] } }));
    expect(plan.carries).toEqual([]);
    expect(plan.continues).toEqual([]);
    expect(plan.drops).toEqual([]);
    expect(outcomeOf(plan, 'mon')).toEqual({ taskId: id('mon'), date: '2026-09-21', rules: 'method', outcome: 'let_go', topStep: 'let_go' });
  });

  it('fixed: nothing moves and nothing is added', () => {
    const plan = on(week({ mon: { kind: 'missed', steps: [step('Group run', 1, 20, 'fixed_time_session'), step('mon review', 2, 10, 'review')] } }));
    expect(plan.carries).toEqual([]);
    expect(plan.continues).toEqual([]);
    expect(outcomeOf(plan, 'mon')).toMatchObject({ outcome: 'fixed', topStep: 'fixed' });
  });

  it('a missed test day is fixed: its steps never move', () => {
    const plan = on(week({ sat: { kind: 'missed' } }, { today: '2026-09-27' }));
    expect(plan.carries).toEqual([]);
    expect(outcomeOf(plan, 'sat')).toMatchObject({ outcome: 'fixed' });
  });
});

describe('what stays as today with the new rules', () => {
  it('the open gap: nothing moves or is marked, and the gap drops are kept', () => {
    const input = week({ mon: { kind: 'missed' }, tue: { kind: 'missed' }, wed: { kind: 'missed', steps: [step('wed drafting', 1, 20, 'drafting'), step('r', 2, 10, 'review')] }, fri: { steps: [step('fri drafting', 1, 30, 'drafting')] } }, { today: '2026-09-25' });
    const plan = on(input);
    expect(plan.carries).toEqual([]);
    expect(plan.continues).toEqual([]);
    expect(plan.drops).toEqual(planCarries(input).drops);
    expect(plan.outcomes!.map((o) => o.outcome)).toEqual(['no_room', 'no_room', 'no_room']);
  });

  it('the key-session hold is kept as today', () => {
    const input = week({ tue: { kind: 'missed', key: true } }, { today: '2026-09-23' });
    const plan = on(input);
    expect(plan.held).toEqual(planCarries(input).held);
    expect(plan.held).toHaveLength(1);
    expect(plan.carries).toEqual([]);
    expect(outcomeOf(plan, 'tue')).toMatchObject({ rules: 'method', outcome: 'held' });
  });
});

describe('RULE-17 counts (MR-19, MR-26)', () => {
  const countable = (input: CarryInput) =>
    input.tasks.map((t) => ({ id: t.id, weekNumber: t.weekNumber, isRestDay: t.isRestDay, isKeySession: t.isKeySession }));

  it('one per missed day by its highest-priority step; practiceDone and the other counts unchanged', () => {
    const input = week(
      {
        mon: { kind: 'missed', steps: [step('mon review', 1, 20, 'review'), step('mon practice', 2, 10, 'practice')] },
        tue: { kind: 'missed', steps: [step('tue heavy', 1, 20, 'heavy'), step('tue heavy 2', 2, 10, 'heavy')] },
        wed: { kind: 'done', steps: [step('wed drafting', 1, 30, 'drafting')] },
        fri: { steps: [step('fri drafting', 1, 30, 'drafting')] },
      },
      { today: '2026-09-25' }
    );
    // Mon: top step let go (its practice step has no open day left). Tue: hard, no room.
    const plan = on(input);
    const legacy = planCarries(input);
    const base = weekCounts(1, { tasks: countable(input), days: input.days, carry: legacy });
    const counts = weekCounts(1, { tasks: countable(input), days: input.days, carry: plan });
    expect(counts).toEqual({ ...base, dropped: counts.dropped, letGo: 1, continued: 0, noRoom: 1 });
    expect(counts.practiceDone).toBe(base.practiceDone);
    expect(counts.missed).toBe(base.missed);
    expect(base).not.toHaveProperty('letGo');
  });

  it('a continued day counts once its marker is stored; the left-behind steps add nothing', () => {
    const input = week({ mon: { kind: 'missed', steps: [step('mon drafting', 1, 15, 'drafting'), step('mon drafting 2', 2, 15, 'drafting')] }, wed: { steps: [step('wed drafting', 1, 30, 'drafting')] } });
    const plan = on(input);
    const countable_ = countable(input);
    expect(weekCounts(1, { tasks: countable_, days: input.days, carry: plan })).toMatchObject({ continued: 0, letGo: 0, noRoom: 0 });
    expect(weekCounts(1, { tasks: countable_, days: input.days, carry: { ...plan, writtenContinues: plan.continues } })).toMatchObject({ continued: 1, letGo: 0, noRoom: 0 });
    const stored = store(input, plan);
    expect(weekCounts(1, { tasks: countable_, days: stored.days, carry: on(stored) })).toMatchObject({ continued: 1, letGo: 0, noRoom: 0 });
  });

  it('a moved session counted as no room is counted once, however many steps it left behind', () => {
    const mon = [step('mon warm-up', 1, 5, 'heavy'), step('mon main', 2, 20, 'heavy'), step('mon cool-down', 3, 5, 'heavy')];
    const input = week({ mon: { kind: 'missed', steps: mon } });
    expect(weekCounts(1, { tasks: countable(input), days: input.days, carry: on(input) })).toMatchObject({ noRoom: 1, letGo: 0, continued: 0 });
  });
});
