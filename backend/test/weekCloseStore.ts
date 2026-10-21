import { vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Weekly update M1.2a: a small in-memory Prisma for the week-close tests. Goals, roadmap weeks, daily tasks and
// review rows live in plain arrays, so the review, the automatic close and reconcile read and write the same rows.
// Interactive transactions run one at a time (a stand-in for Postgres's row locks on the closing week) and roll back
// when their callback throws.

type Row = Record<string, any>;

interface State {
  goals: Row[];
  weeks: Row[];
  tasks: Row[];
  reviews: Row[];
}

const empty = (): State => ({ goals: [], weeks: [], tasks: [], reviews: [] });

/** Plain equality, `{ not }`, `{ in }` and `OR`: the only filters the code under test uses. */
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Row[]).some((part) => matches(row, part));
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('not' in cond) return row[key] !== cond.not && !(cond.not !== null && row[key] === null);
      if ('in' in cond) return (cond.in as unknown[]).includes(row[key]);
      if ('lt' in cond) return row[key] < cond.lt;
      return matches(row[key] ?? {}, cond);
    }
    // Prisma reads a field that was never written as null.
    return cond === null ? (row[key] ?? null) === null : row[key] === cond;
  });
}

function project(row: Row, select: Row | undefined): Row {
  if (!select) return row;
  const out: Row = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) continue;
    out[key] = value === true ? row[key] : Array.isArray(row[key]) ? row[key].map((item: Row) => project(item, value.select)) : row[key];
  }
  return out;
}

function apply(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) row[key] = value === Prisma.DbNull || value === Prisma.JsonNull ? null : structuredClone(value);
}

const byDay = (a: Row, b: Row) => a.dayNumber - b.dayNumber;

export const db = {
  state: empty(),
  /** Make the next `dailyTask.createMany` throw (a failure inside the close's transaction). */
  failCreate: false,
  reset() {
    db.state = empty();
    db.failCreate = false;
    lock = Promise.resolve();
  },
  /** The closing week's and the goal's rows, for assertions. */
  goal(id = 'g1') {
    return db.state.goals.find((g) => g.id === id)!;
  },
  week(weekNumber: number, goalId = 'g1') {
    return db.state.weeks.find((w) => w.goalId === goalId && w.weekNumber === weekNumber)!;
  },
  tasksOf(weekNumber: number, goalId = 'g1') {
    return db.state.tasks.filter((t) => t.goalId === goalId && t.weekNumber === weekNumber).sort(byDay);
  },
  prisma: {} as any,
};

let lock: Promise<unknown> = Promise.resolve();
let nextId = 0;

function goalWith(goal: Row, args: Row): Row {
  const relations = { ...(args.include ?? {}), ...(args.select ?? {}) };
  const full: Row = { ...goal };
  if (relations.roadmapWeeks) {
    full.roadmapWeeks = db.state.weeks.filter((w) => w.goalId === goal.id && matches(w, relations.roadmapWeeks.where)).sort((a, b) => a.weekNumber - b.weekNumber);
  }
  if (relations.dailyTasks) {
    full.dailyTasks = db.state.tasks.filter((t) => t.goalId === goal.id && matches(t, relations.dailyTasks.where)).sort(byDay);
  }
  return structuredClone(args.select ? project(full, args.select) : full);
}

db.prisma = {
  goal: {
    findFirst: vi.fn(async (args: Row) => {
      const goal = db.state.goals.find((g) => matches(g, args.where));
      return goal ? goalWith(goal, args) : null;
    }),
    update: vi.fn(async ({ where, data }: Row) => {
      const goal = db.state.goals.find((g) => matches(g, where));
      if (!goal) throw new Error('goal not found');
      apply(goal, data);
      return structuredClone(goal);
    }),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = db.state.goals.filter((g) => matches(g, where));
      rows.forEach((g) => apply(g, data));
      return { count: rows.length };
    }),
  },
  roadmapWeek: {
    update: vi.fn(async ({ where, data }: Row) => {
      const key = where.goalId_weekNumber;
      const week = key ? db.state.weeks.find((w) => w.goalId === key.goalId && w.weekNumber === key.weekNumber) : db.state.weeks.find((w) => w.id === where.id);
      if (!week) throw new Error('week not found');
      apply(week, data);
      return structuredClone(week);
    }),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = db.state.weeks.filter((w) => matches(w, where));
      rows.forEach((w) => apply(w, data));
      return { count: rows.length };
    }),
  },
  weeklyReview: {
    upsert: vi.fn(async ({ where, update, create }: Row) => {
      const key = where.goalId_weekNumber;
      const found = db.state.reviews.find((r) => r.goalId === key.goalId && r.weekNumber === key.weekNumber);
      if (found) apply(found, update);
      else db.state.reviews.push({ id: `rev-${++nextId}`, ...structuredClone(create) });
      return structuredClone(found ?? db.state.reviews.at(-1)!);
    }),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = db.state.reviews.filter((r) => matches(r, where));
      rows.forEach((r) => apply(r, data));
      return { count: rows.length };
    }),
  },
  dailyTask: {
    findMany: vi.fn(async ({ where }: Row) => structuredClone(db.state.tasks.filter((t) => matches(t, where)).sort(byDay))),
    deleteMany: vi.fn(async ({ where }: Row) => {
      const before = db.state.tasks.length;
      db.state.tasks = db.state.tasks.filter((t) => !matches(t, where));
      return { count: before - db.state.tasks.length };
    }),
    createMany: vi.fn(async ({ data }: Row) => {
      if (db.failCreate) throw new Error('createMany failed');
      for (const row of data) {
        // Ids follow the day, so the same week written twice gets the same ids (R-2 compares reconcile bodies).
        db.state.tasks.push({ id: `${row.goalId}-d${row.dayNumber}`, status: 'pending', usedMinimumVersion: false, notOffered: false, notes: null, completedAt: null, ...structuredClone(row) });
      }
      return { count: data.length };
    }),
    updateMany: vi.fn(async ({ where, data }: Row) => {
      const rows = db.state.tasks.filter((t) => matches(t, where));
      rows.forEach((t) => apply(t, data));
      return { count: rows.length };
    }),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const run = lock.then(async () => {
      const snapshot = structuredClone(db.state);
      try {
        return await fn(db.prisma);
      } catch (err) {
        db.state = snapshot;
        throw err;
      }
    });
    lock = run.catch(() => undefined);
    return run;
  }),
};
