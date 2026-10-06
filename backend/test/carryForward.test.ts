import { describe, it, expect } from 'vitest';
import {
  fitCarriedStep,
  parseStoredSteps,
  planCarries,
  type CarriedStep,
  type CarryInput,
  type CarryPlan,
  type CarryTask,
} from '../src/lib/carryForward.js';
import { findOpenGap, type DayClassification, type DayKind } from '../src/lib/missedSessions.js';

// Missed sessions M2.2: the pure carry planner (ND-9 to ND-17, RULE-1, RULE-10).

const CUSTOM = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };
const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };

const step = (title: string, priority: number, minutes: number, extra: Partial<CarriedStep> = {}): CarriedStep => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...extra,
});

/** A 30-minute practice day: lead 15, second 10, third 5. */
const practiceSteps = (tag: string): CarriedStep[] => [
  step(`${tag} lead`, 1, 15),
  step(`${tag} second`, 2, 10),
  step(`${tag} third`, 3, 5),
];

/** Steady week from Monday 2026-09-21: Mon-Wed practice, Thu rest, Fri practice, Sat test, Sun rest. */
const DATES = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Name = (typeof NAMES)[number];

interface DaySpec {
  kind?: DayKind;
  key?: boolean;
  steps?: CarriedStep[];
  minutes?: number;
}

function week(spec: Partial<Record<Name, DaySpec>>, options: { today?: string; goal?: CarryInput['goal']; weekNumber?: number } = {}) {
  const weekNumber = options.weekNumber ?? 1;
  const tasks: CarryTask[] = [];
  const days: DayClassification[] = [];
  NAMES.forEach((name, index) => {
    const isRestDay = name === 'thu' || name === 'sun';
    const isTestDay = name === 'sat';
    const s = spec[name] ?? {};
    const steps =
      s.steps ?? (isRestDay ? [] : isTestDay ? [step('Warm up', 2, 5), step('Weekly test: 1-minute test', 1, 15), step('Compare', 3, 10)] : practiceSteps(name));
    const id = `w${weekNumber}-${name}`;
    tasks.push({
      id,
      date: DATES[index],
      weekNumber,
      dayNumber: index + 1,
      status: s.kind === 'done' ? 'completed' : 'pending',
      isRestDay,
      isKeySession: !!s.key,
      isTestDay,
      durationMinutes: s.minutes ?? steps.reduce((sum, x) => sum + x.durationMinutes, 0),
      steps,
    });
    days.push({
      taskId: id,
      date: DATES[index],
      weekNumber,
      dayNumber: index + 1,
      isKeySession: !!s.key,
      isTestDay,
      kind: isRestDay ? 'rest' : s.kind ?? 'planned',
    });
  });
  const input: CarryInput = {
    days,
    gap: findOpenGap(days),
    tasks,
    goal: options.goal ?? CUSTOM,
    today: options.today ?? '2026-09-22',
    timezone: 'UTC',
    sleepTime: '23:00',
  };
  return input;
}

const dropOf = (plan: CarryPlan, name: Name) => plan.drops.find((d) => d.taskId === `w1-${name}`)?.reason;
const total = (steps: CarriedStep[]) => steps.reduce((sum, s) => sum + s.durationMinutes, 0);

describe('planCarries: when a step carries', () => {
  it('carries a missed day onto the next practice day (AC-3)', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' } }));
    expect(plan.drops).toEqual([]);
    expect(plan.carries).toHaveLength(1);
    const carry = plan.carries[0];
    expect(carry).toMatchObject({ fromTaskId: 'w1-mon', fromDate: '2026-09-21', toTaskId: 'w1-tue', toDate: '2026-09-22' });
    expect(carry.step).toMatchObject({ title: 'mon lead', priority: 2, carriedFrom: { taskId: 'w1-mon', date: '2026-09-21' } });
    expect(carry.step.carriedFrom!.replaced).toEqual(carry.replaced);
    expect(carry.durationMinutes).toBeLessThanOrEqual(30);
  });

  it('drops the day before the test day: nothing lands on the test day (AC-4)', () => {
    const plan = planCarries(week({ fri: { kind: 'missed' } }, { today: '2026-09-26' }));
    expect(dropOf(plan, 'fri')).toBe('no_receiving_day');
    expect(plan.carries).toEqual([]);
  });

  it('drops a missed test day: no receiving day later that week, and never next week', () => {
    const input = week({ sat: { kind: 'missed' } }, { today: '2026-09-27' });
    const next = week({}, { weekNumber: 2 });
    input.tasks = [...input.tasks, ...next.tasks.map((t) => ({ ...t, date: `2026-09-${28 + t.dayNumber - 1}` }))];
    input.days = [...input.days, ...next.days.map((d) => ({ ...d, date: `2026-09-${28 + d.dayNumber - 1}` }))];
    expect(dropOf(planCarries(input), 'sat')).toBe('no_receiving_day');
  });

  it('skips a rest day to reach the receiving day (Wed → Fri)', () => {
    const plan = planCarries(week({ wed: { kind: 'missed' } }, { today: '2026-09-24' }));
    expect(plan.carries.map((c) => c.toTaskId)).toEqual(['w1-fri']);
  });
});

describe('planCarries: the fixed receiving day (ND-17)', () => {
  it('drops when the receiving day has closed (it was missed too), and carries the later miss', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { kind: 'missed' } }, { today: '2026-09-23' }));
    expect(dropOf(plan, 'mon')).toBe('receiving_day_closed');
    expect(plan.carries.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([['w1-tue', 'w1-wed']]);
  });

  it('drops when the receiving day is done', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { kind: 'done' } }, { today: '2026-09-23' }));
    expect(dropOf(plan, 'mon')).toBe('receiving_day_done');
    expect(plan.carries).toEqual([]);
  });

  it('drops when the receiving day is dated before today, even before its close', () => {
    // Tue is still open (planned) just after midnight, but it is no longer today.
    const plan = planCarries(week({ mon: { kind: 'missed' } }, { today: '2026-09-23' }));
    expect(dropOf(plan, 'mon')).toBe('receiving_day_closed');
  });

  it('drops when the receiving day already holds a carry', () => {
    const tue = practiceSteps('tue');
    tue[1] = { ...tue[1], carriedFrom: { taskId: 'elsewhere', date: '2026-09-20', replaced: [] } };
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { steps: tue } }));
    expect(dropOf(plan, 'mon')).toBe('receiving_day_taken');
  });

  it('never redirects a dropped step to a later day', () => {
    // Mon's receiving day (Tue) is done; Wed is open, but Mon is not carried there.
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { kind: 'done' } }, { today: '2026-09-23' }));
    expect(plan.carries.some((c) => c.fromTaskId === 'w1-mon')).toBe(false);
  });

  it('most recent miss wins a shared receiving day (ND-12); the other is lost_to_later_miss', () => {
    // Two missed days can only share a receiving day when a test day sits between them and it, which the
    // current week layout never does; this builds that shape directly.
    const input = week({ mon: { kind: 'missed' }, tue: { kind: 'missed' } }, { today: '2026-09-23' });
    for (const list of [input.tasks, input.days] as Array<Array<{ taskId?: string; id?: string; isTestDay: boolean }>>) {
      for (const item of list) item.isTestDay = (item.id ?? item.taskId) === 'w1-tue';
    }
    const plan = planCarries(input);
    expect(dropOf(plan, 'mon')).toBe('lost_to_later_miss');
    expect(plan.carries.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([['w1-tue', 'w1-wed']]);
  });
});

describe('planCarries: drops', () => {
  it('carries nothing from an open gap (ND-11)', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { kind: 'missed' }, wed: { kind: 'missed' } }, { today: '2026-09-25' }));
    expect(plan.carries).toEqual([]);
    expect(['mon', 'tue', 'wed'].map((n) => dropOf(plan, n as Name))).toEqual(['in_gap', 'in_gap', 'in_gap']);
  });

  it('drops a high-load step (RULE-10, AC-13)', () => {
    const mon = practiceSteps('mon');
    mon[0] = { ...mon[0], highLoad: true };
    expect(dropOf(planCarries(week({ mon: { kind: 'missed', steps: mon } })), 'mon')).toBe('high_load');
  });

  it('drops any step of a run10k goal, even stored without the flag (M2.1)', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' } }, { goal: RUN_10K }));
    expect(dropOf(plan, 'mon')).toBe('high_load');
    expect(plan.carries).toEqual([]);
  });

  it('drops a day with no priority-1 step', () => {
    const plan = planCarries(week({ mon: { kind: 'missed', steps: [step('no rank', 2, 30)] }, wed: { kind: 'missed', steps: [] } }, { today: '2026-09-24' }));
    expect(dropOf(plan, 'mon')).toBe('no_priority_step');
    expect(dropOf(plan, 'wed')).toBe('no_priority_step');
  });

  it('drops a step that does not fit, and never removes the receiving day’s priority-1 step', () => {
    const plan = planCarries(week({ mon: { kind: 'missed' }, tue: { steps: [step('tue lead', 1, 25), step('tue short', 2, 5)] } }));
    expect(dropOf(plan, 'mon')).toBe('does_not_fit');
  });
});

describe('planCarries: key sessions (ND-9)', () => {
  it('holds a missed key session while its receiving day is open, and writes nothing for it', () => {
    const plan = planCarries(week({ tue: { kind: 'missed', key: true } }, { today: '2026-09-23' }));
    expect(plan.held).toEqual([{ taskId: 'w1-tue', date: '2026-09-22', receivingTaskId: 'w1-wed', offerUntil: '2026-09-24T01:00:00.000Z' }]);
    expect(plan.carries).toEqual([]);
    expect(plan.drops).toEqual([]);
  });

  it('drops it as swap_unanswered once the receiving day closes unanswered', () => {
    const plan = planCarries(week({ tue: { kind: 'missed', key: true }, wed: { kind: 'missed' } }, { today: '2026-09-24' }));
    expect(dropOf(plan, 'tue')).toBe('swap_unanswered');
    expect(plan.held).toEqual([]);
  });
});

describe('planCarries: already carried', () => {
  it('finds a stored marker, reports it, and never plans that day again', () => {
    const first = planCarries(week({ mon: { kind: 'missed' } }));
    const carried = first.carries[0];
    const after = week({ mon: { kind: 'missed' }, tue: { steps: carried.steps, minutes: carried.durationMinutes } });
    const again = planCarries(after);
    expect(again.carries).toEqual([]);
    expect(again.drops).toEqual([]);
    expect(again.alreadyCarried).toEqual([
      { fromTaskId: 'w1-mon', fromDate: '2026-09-21', toTaskId: 'w1-tue', toDate: '2026-09-22', step: carried.step },
    ]);
  });

  it('is deterministic for the same input', () => {
    const input = week({ mon: { kind: 'missed' }, tue: { kind: 'missed', key: true }, fri: { kind: 'missed' } }, { today: '2026-09-22' });
    expect(planCarries(input)).toEqual(planCarries(input));
  });
});

describe('fitCarriedStep (ND-10, RULE-1)', () => {
  const carried = (minutes: number) => step('carried', 1, minutes, { carriedFrom: { taskId: 'src', date: '2026-09-21', replaced: [] } });

  it('replaces one step when that frees enough minutes', () => {
    const fit = fitCarriedStep({ steps: practiceSteps('r'), durationMinutes: 30 }, carried(5))!;
    expect(fit.replaced.map((s) => s.title)).toEqual(['r third']);
    expect(fit.durationMinutes).toBe(30);
  });

  it('replaces two steps, lowest priority first, when one is not enough', () => {
    const fit = fitCarriedStep({ steps: practiceSteps('r'), durationMinutes: 30 }, carried(15))!;
    expect(fit.replaced.map((s) => s.title)).toEqual(['r second', 'r third']);
    expect(fit.steps.map((s) => s.title)).toEqual(['r lead', 'carried']);
    expect(fit.durationMinutes).toBe(30);
  });

  it('can leave the day shorter than before, never longer', () => {
    const fit = fitCarriedStep({ steps: practiceSteps('r'), durationMinutes: 30 }, carried(8))!;
    expect(fit.replaced.map((s) => s.title)).toEqual(['r second', 'r third']);
    expect(fit.durationMinutes).toBe(23);
  });

  it('renumbers stepNumber and priority: carried step second, the rest in their order', () => {
    const steps = [step('a', 3, 5), step('lead', 1, 10), step('b', 2, 10), step('c', 4, 5)];
    const fit = fitCarriedStep({ steps, durationMinutes: 30 }, carried(5))!;
    expect(fit.steps.map((s) => [s.title, s.stepNumber, s.priority])).toEqual([
      ['a', 1, 4],
      ['lead', 2, 1],
      ['carried', 3, 2],
      ['b', 4, 3],
    ]);
  });

  it('never removes a test step (by priority 0 or by title) or the priority-1 step', () => {
    const withTest = [step('Weekly test: run 2 km', 2, 10), step('lead', 1, 10), step('Zero', 0, 5), step('extra', 3, 5)];
    expect(fitCarriedStep({ steps: withTest, durationMinutes: 30 }, carried(10))).toBeNull();
    const fit = fitCarriedStep({ steps: withTest, durationMinutes: 30 }, carried(5))!;
    expect(fit.replaced.map((s) => s.title)).toEqual(['extra']);
    expect(fit.steps.find((s) => s.title === 'Zero')!.priority).toBe(0);
  });

  it('does not fit when the receiving steps have no priorities', () => {
    const unranked = practiceSteps('r').map(({ priority: _p, ...rest }) => rest as CarriedStep);
    expect(fitCarriedStep({ steps: unranked, durationMinutes: 30 }, carried(5))).toBeNull();
  });

  it('never exceeds the planned minutes even when they are below the step total', () => {
    const fit = fitCarriedStep({ steps: practiceSteps('r'), durationMinutes: 25 }, carried(5))!;
    expect(fit.durationMinutes).toBeLessThanOrEqual(25);
  });
});

describe('parseStoredSteps', () => {
  it('reads a JSON array and treats anything else as no steps', () => {
    expect(parseStoredSteps(JSON.stringify(practiceSteps('x')))).toHaveLength(3);
    for (const bad of [undefined, null, '', 'not json', '{"a":1}', 42]) expect(parseStoredSteps(bad)).toEqual([]);
  });
});

// Property-style: many weeks and miss patterns, replayed day by day with every planned carry written.
describe('invariants over generated weeks', () => {
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('never lengthens a day, carries at most once per receiving day, and replanning adds nothing', () => {
    const random = rng(20261007);
    let carriesSeen = 0;
    for (let run = 0; run < 400; run++) {
      const goal = random() < 0.15 ? RUN_10K : CUSTOM;
      const spec: Partial<Record<Name, DaySpec>> = {};
      for (const name of NAMES) {
        const count = 2 + Math.floor(random() * 3);
        const minutes = Array.from({ length: count }, () => 5 + Math.floor(random() * 4) * 5);
        const order = Array.from({ length: count }, (_, i) => i + 1).sort(() => random() - 0.5);
        spec[name] = {
          key: random() < 0.2,
          steps: minutes.map((m, i) => step(`${name} ${i}`, order[i], m, random() < 0.2 ? { highLoad: true } : {})),
        };
      }
      const outcome = NAMES.map(() => (random() < 0.45 ? 'missed' : 'done'));
      const input = week(spec, { goal });
      const planned = new Map(input.tasks.map((t) => [t.id, t.durationMinutes]));
      const carriedInto = new Map<string, number>();
      const dropped = new Set<string>();

      // Each day of the week closes in turn; reconcile runs (twice) after every close.
      for (let close = 0; close <= 7; close++) {
        input.today = DATES[Math.min(close, 6)];
        input.days = input.days.map((d, i) =>
          d.kind === 'rest' ? d : { ...d, kind: i < close ? (outcome[i] as DayKind) : 'planned' }
        );
        input.gap = findOpenGap(input.days);
        for (let pass = 0; pass < 2; pass++) {
          const plan = planCarries(input);
          if (pass === 1) expect(plan.carries).toEqual([]);
          for (const drop of plan.drops) dropped.add(drop.taskId);
          for (const carry of plan.carries) {
            carriesSeen++;
            const from = input.days.find((d) => d.taskId === carry.fromTaskId)!;
            const to = input.days.find((d) => d.taskId === carry.toTaskId)!;
            expect(to.isTestDay).toBe(false);
            expect(input.gap?.taskIds ?? []).not.toContain(from.taskId);
            expect(dropped.has(from.taskId)).toBe(false);
            expect(carry.step.highLoad === true || goal === RUN_10K).toBe(false);
            expect(total(carry.steps)).toBeLessThanOrEqual(planned.get(to.taskId)!);
            expect(carry.durationMinutes).toBeLessThanOrEqual(planned.get(to.taskId)!);
            carriedInto.set(to.taskId, (carriedInto.get(to.taskId) ?? 0) + 1);
            const target = input.tasks.find((t) => t.id === carry.toTaskId)!;
            target.steps = carry.steps;
            target.durationMinutes = carry.durationMinutes;
          }
        }
      }
      for (const count of carriedInto.values()) expect(count).toBe(1);
      for (const task of input.tasks) expect(task.durationMinutes).toBeLessThanOrEqual(planned.get(task.id)!);
    }
    expect(carriesSeen).toBeGreaterThan(50);
  });
});
