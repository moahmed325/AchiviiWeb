import { withFixedKinds, type RecoveryKind, type RecoveryProfile } from '../src/lib/recovery/profile.js';

// Method-aware recovery M3.2: random tagged weeks and profiles for the generated tests (AC-6, AC-8), and checks of
// fixed steps, order and the rest gap written apart from the code they test. Used by methodSwap.test.ts (pure) and
// methodActions.test.ts (the routes).

export type Step = Record<string, unknown> & { title: string; priority: number; stepNumber: number; durationMinutes: number; kind?: string };

export interface Row {
  id: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  isRestDay: boolean;
  isKeySession: boolean;
  isTestDay: boolean;
  durationMinutes: number;
  detailedSteps: string;
}

/** A small seeded random number generator (mulberry32), so a failing seed can be replayed. */
export function random(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)] };
}

const kind = (id: string, overrides: Partial<RecoveryKind> = {}): RecoveryKind => ({
  id,
  name: id.replace(/_/g, ' '),
  description: `A ${id} step.`,
  action: 'move',
  hard: false,
  inOrder: false,
  ...overrides,
});

export function randomProfile(restGapDays: number): RecoveryProfile {
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

const POOL = ['practice', 'practice', 'drafting', 'review', 'lesson', 'lesson', 'heavy', 'strength', 'general', 'fixed_time_session'] as const;
/** Kinds whose titles carry their written number, so order can be checked from the title alone. */
export const IN_ORDER = ['lesson', 'strength'] as const;
const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const dateOf = (week: number, index: number) => new Date(Date.parse('2026-09-14T00:00:00Z') + ((week - 1) * 7 + index) * 86_400_000).toISOString().slice(0, 10);

/**
 * Week 1 (from Mon 2026-09-14) is done; week 2 (from Mon 2026-09-21) holds today, a random weekday. Thu and Sun are
 * rest, Sat the test day. Days before today are done or missed; one week-2 practice day may be a key session.
 */
export function randomWeek(seed: number) {
  const r = random(seed);
  const profile = randomProfile(r.int(3));
  const todayIndex = r.pick([0, 1, 2, 4]);
  const today = dateOf(2, todayIndex);
  const numbers: Record<string, number> = { lesson: 0, strength: 0 };
  // Usually a missed key session (a day before today), so holds and move-now are well covered.
  const keyIndex = todayIndex > 0 && r.next() < 0.8 ? r.pick([0, 1, 2, 4].filter((i) => i < todayIndex)) : -1;
  const rows: Row[] = [];
  for (const week of [1, 2]) {
    NAMES.forEach((name, index) => {
      const id = `${week}-${name}`;
      const isRestDay = name === 'thu' || name === 'sun';
      const isTestDay = name === 'sat';
      let steps: Step[] = [];
      if (isTestDay) steps = [{ stepNumber: 1, priority: 1, title: 'Weekly test: 1-minute test', durationMinutes: 20, kind: 'weekly_test', instructions: 'Test.' }];
      else if (!isRestDay) {
        const count = 1 + r.int(3);
        for (let i = 0; i < count; i += 1) {
          const k = r.pick(POOL);
          const title = (IN_ORDER as readonly string[]).includes(k) ? `${k === 'lesson' ? 'Lesson' : 'Strength'} ${(numbers[k] += 1)}` : `${id} ${k} ${i + 1}`;
          steps.push({
            stepNumber: i + 1,
            priority: i + 1,
            title,
            durationMinutes: 5 + 5 * r.int(4),
            kind: k,
            instructions: `Do ${title}.`,
            ...(k === 'practice' && r.next() < 0.15 ? { highLoad: true } : {}),
          });
        }
      }
      const date = dateOf(week, index);
      const before = week === 1 || date < today;
      const status = !isRestDay && before && (week === 1 || (index !== keyIndex && r.next() < 0.5)) ? 'completed' : 'pending';
      rows.push({
        id,
        date,
        weekNumber: week,
        dayNumber: (week - 1) * 7 + index + 1,
        status,
        isRestDay,
        isKeySession: week === 2 && index === keyIndex,
        isTestDay,
        durationMinutes: steps.reduce((sum, s) => sum + s.durationMinutes, 0),
        detailedSteps: JSON.stringify(steps),
      });
    });
  }
  return { profile, today, now: new Date(`${today}T10:00:00Z`), rows };
}

export const stepsIn = (row: Pick<Row, 'detailedSteps'>): Step[] => JSON.parse(row.detailedSteps);
const dayCount = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
/** A day the rest gap counts: done, or open today or later. */
const counts = (row: Row, today: string) => !row.isRestDay && (row.status === 'completed' || row.date >= today);
const isHard = (step: Step, profile: RecoveryProfile) => step.highLoad === true || !!profile.kinds.find((k) => k.id === step.kind)?.hard;
const isFixed = (step: Step) => step.kind === 'weekly_test' || step.kind === 'fixed_time_session' || /^weekly test/i.test(step.title);
/** Where a step was written (its marker's day, or its own day), with its title: the step's identity. */
const identity = (step: Step, row: Row) => `${((step.shiftedFrom ?? step.carriedFrom ?? step.swappedFrom) as { taskId?: string } | undefined)?.taskId ?? row.id}|${step.title}`;

/** RULE-12: neither day holds a fixed step. */
export const noFixed = (...rows: Row[]) => rows.every((row) => !stepsIn(row).some(isFixed));

/**
 * RULE-13: pairs of in-order steps not done yet (week 2) that stand against their written number. A step done on any
 * day is done; the live copy of a step is the one on its latest day.
 */
export function orderBreaks(rows: readonly Row[]): Set<string> {
  const breaks = new Set<string>();
  const done = new Set(rows.filter((row) => row.status === 'completed').flatMap((row) => stepsIn(row).map((step) => identity(step, row))));
  for (const k of IN_ORDER) {
    const live = new Map<string, { n: number; date: string; index: number }>();
    for (const row of [...rows].filter((x) => x.weekNumber === 2 && !x.isRestDay).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      stepsIn(row).forEach((step, index) => {
        if (step.kind === k) live.set(identity(step, row), { n: Number(step.title.split(' ')[1]), date: row.date, index });
      });
    }
    const open = [...live].filter(([id]) => !done.has(id)).map(([, item]) => item);
    for (const x of open) for (const y of open) if (x.n < y.n && (x.date > y.date || (x.date === y.date && x.index > y.index))) breaks.add(`${k}${x.n}>${y.n}`);
  }
  return breaks;
}

/** RULE-14: every pair of days (a day with itself for two hard steps) holding hard steps closer than the rest gap. */
export function closeDays(rows: readonly Row[], profile: RecoveryProfile, today: string): Set<string> {
  const hard = rows.filter((row) => counts(row, today)).flatMap((row) => stepsIn(row).filter((s) => isHard(s, profile)).map(() => row));
  const out = new Set<string>();
  hard.forEach((x, i) =>
    hard.forEach((y, j) => {
      if (i < j && Math.abs(dayCount(x.date) - dayCount(y.date)) <= profile.restGapDays) out.add([x.id, y.id].sort().join('~'));
    })
  );
  return out;
}

/** RULE-14 for a swap: pairs of hard steps (by title) on counted days closer than the rest gap. */
export function closeSteps(rows: readonly Row[], profile: RecoveryProfile, today: string): Set<string> {
  const hard = rows.filter((row) => counts(row, today)).flatMap((row) => stepsIn(row).filter((s) => isHard(s, profile)).map((s) => ({ row, title: s.title })));
  const out = new Set<string>();
  for (const x of hard)
    for (const y of hard)
      if (x.title < y.title && x.row.id !== y.row.id && Math.abs(dayCount(x.row.date) - dayCount(y.row.date)) <= profile.restGapDays) out.add(`${x.title}~${y.title}`);
  return out;
}

export const subset = (a: Set<string>, b: Set<string>) => [...a].filter((item) => !b.has(item));

/** The rows after a swap of a and b: the steps change days, dates and status stay. */
export function swapped(rows: readonly Row[], a: string, b: string): Row[] {
  const rowA = rows.find((row) => row.id === a)!;
  const rowB = rows.find((row) => row.id === b)!;
  return rows.map((row) =>
    row.id === a
      ? { ...row, detailedSteps: rowB.detailedSteps, durationMinutes: rowB.durationMinutes }
      : row.id === b
        ? { ...row, detailedSteps: rowA.detailedSteps, durationMinutes: rowA.durationMinutes }
        : row
  );
}
