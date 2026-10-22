/**
 * Weekly update M3.2: the saved roadmaps, the hand-made cases, and how one case becomes the goal `planWeeklyUpdate`
 * reads (the review route's `writerGoal`: every roadmap week, and the closing week's days), plus the in-memory stand-in
 * for the three database reads the update makes (`historyOf`, `weekBeforeOf`, `countsOf`'s `loadReconcileGoal`).
 */
import type { DailyTask, RoadmapWeek, WeeklyReview } from '@prisma/client';
import type { LoweredTarget, Roadmap, WeekTarget, WeekTest } from '../../src/lib/ai/roadmap.js';
import type { WeekDayPlan } from '../../src/lib/ai/weekPlan.js';
import type { StoredRoadmap } from '../../src/lib/planV2.js';
import type { ClosingGoal } from '../../src/lib/weekClose/close.js';

export interface RoadmapEntry {
  goalId: string;
  /** Roadmap calls made, including the one that passed. */
  calls: number;
  /** The reasons earlier calls failed. */
  failures: string[];
  roadmap: Roadmap;
  /** `Goal.roadmap` as goal create stores it, with the recovery profile code uses at create. */
  stored: StoredRoadmap;
  weeks: Array<{ weekNumber: number; target: WeekTarget; test: WeekTest; light: boolean }>;
  loweredAtCreate: LoweredTarget[];
}

/** A stored `RoadmapWeek.testResult`, as the review saves it. */
export interface TestResult {
  value: number | string;
  passed: boolean;
  unit?: string;
  note?: string;
}

export type DayState = 'done' | 'missed' | 'minimum';

export interface HistoryWeek {
  week: number;
  /** null: not logged. Missing: passed at the week's own target. */
  result?: TestResult | null;
  done: number;
  planned: number;
  status: 'on_track' | 'a_bit_behind' | 'far_behind' | null;
}

export interface EvalCase {
  id: string;
  goalId: string;
  /** The closing week. */
  week: number;
  why: string;
  /** METHOD_RECOVERY_ENABLED for this case, set only inside the script's process. */
  methodRecovery: boolean;
  /** The test day's state. */
  testDay: DayState;
  /** Every key session that is not the test day. Missing: key sessions take `other` in order like any day. */
  key?: DayState;
  /**
   * The first `count` (all when missing) days that are not the test day and hold a step of this kind take `state`,
   * before `key` and `other` (for the in-order cases: a week behind, a step behind).
   */
  kindDays?: { kind: string; state: DayState; count?: number };
  /** The other practice days, in date order; days past the list take `fill`. */
  other: DayState[];
  fill: DayState;
  /** The closing week's stored test result; null: not logged. */
  test: TestResult | null;
  reflection: string;
  /** Up to 3 closed weeks before this one. Older closed weeks passed at their own target with status on_track. */
  history: HistoryWeek[];
  /** Weeks whose stored target earlier updates changed (written by hand; any other week is the roadmap's). */
  storedTargets?: Array<{ week: number; target: WeekTarget }>;
}

/** One case's closing week as the week writer wrote it live. */
export interface WeekEntry {
  caseId: string;
  /** Week calls made, including the one that passed. */
  calls: number;
  ms: number;
  days: WeekDayPlan[];
}

export const START_DATE = '2026-08-03';
export const TIMEZONE = 'UTC';
export const ROUTINE = { wakeTime: '07:00', sleepTime: '23:00', busyHours: '09:00 - 17:00', preferredSlot: 'evening', dailyMinutes: 45, planVariant: 'steady', commitments: [] };
export const USER_ID = 'eval-user';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/** The morning after the closing week's last day: every day of it has closed, and the next week starts today (no gap). */
export function closeNow(week: number): Date {
  return new Date(addDays(day(START_DATE), week * 7).getTime() + 10 * 3_600_000);
}

const goalIdOf = (c: Pick<EvalCase, 'id'>) => `goal-${c.id}`;

/** A passed result at the week's own target (the older closed weeks). */
function passedAt(target: WeekTarget, light: boolean): TestResult {
  if (light) return { value: 'Done', passed: true, note: 'Done as written' };
  return target.kind === 'number' ? { value: target.value, passed: true, unit: target.unit } : { value: 'Done', passed: true };
}

/** Every roadmap week as stored for this case: closed weeks before it, the closing week active, the rest pending. */
export function roadmapRows(entry: RoadmapEntry, c: EvalCase): RoadmapWeek[] {
  const goalId = goalIdOf(c);
  const override = new Map((c.storedTargets ?? []).map((item) => [item.week, item.target]));
  return entry.roadmap.weeks.map((week) => {
    const target = override.get(week.weekNumber) ?? week.target;
    const light = week.test?.light === true;
    const history = c.history.find((item) => item.week === week.weekNumber);
    const closed = week.weekNumber < c.week;
    const testResult = week.weekNumber === c.week ? c.test : closed ? (history && history.result !== undefined ? history.result : passedAt(target, light)) : null;
    return {
      id: `${goalId}-w${week.weekNumber}`,
      goalId,
      weekNumber: week.weekNumber,
      phase: week.phase,
      theme: week.focus,
      objective: target.kind === 'number' ? `${target.metric}: ${target.value} ${target.unit}` : target.description,
      keyMilestone: week.test?.passIf ?? '',
      targetIntensity: 60,
      plannedMinutes: ROUTINE.dailyMinutes * 5,
      status: closed ? 'completed' : week.weekNumber === c.week ? 'active' : 'pending',
      executionScore: null,
      reviewNotes: null,
      target: target as never,
      test: week.test as never,
      testResult: (testResult ?? null) as never,
      closedBy: closed ? 'review' : null,
      closedAt: closed ? addDays(day(START_DATE), week.weekNumber * 7) : null,
      jumped: false,
      breakDays: null,
      updateStatus: closed ? (history ? history.status : 'on_track') : null,
      retestOfWeek: null,
      dailyTimeAskedAt: null,
      closeLineSeenAt: null,
      created_at: day(START_DATE),
    } as RoadmapWeek;
  });
}

/** The goal row for a case, with the given weeks and days. */
export function goalRow(entry: RoadmapEntry, c: EvalCase, rawGoal: string, roadmapWeeks: RoadmapWeek[], dailyTasks: DailyTask[]): ClosingGoal {
  const start = day(START_DATE);
  return {
    id: goalIdOf(c),
    userId: USER_ID,
    rawGoal,
    clarifiedOutcome: entry.roadmap.finalGoal,
    methodologyNotes: `${entry.roadmap.method.name}: ${entry.roadmap.method.summary}`,
    status: 'active',
    startDate: start,
    targetDate: addDays(start, 90),
    currentWeek: c.week,
    answers: '{}',
    routine: JSON.stringify(ROUTINE),
    created_at: start,
    updated_at: start,
    completedAt: null,
    isGoldenRail: false,
    canonicalMethodName: entry.roadmap.method.name,
    canonicalAuthority: entry.roadmap.method.creator || null,
    canonicalSourceUrl: null,
    methodConfidence: null,
    methodKind: null,
    teachings: null,
    workBlocks: null,
    allowedUrls: null,
    velocityTable: null,
    canonicalKey: null,
    planVersion: 2,
    roadmap: JSON.parse(JSON.stringify(entry.stored)),
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
    roadmapWeeks,
    dailyTasks,
  } as unknown as ClosingGoal;
}

/** The closing week's days as stored, with the case's hand-set states. */
export function dayRows(c: EvalCase, days: WeekDayPlan[]): DailyTask[] {
  const goalId = goalIdOf(c);
  const queue = [...c.other];
  let kindLeft = c.kindDays ? (c.kindDays.count ?? Infinity) : 0;
  return days.map((plan) => {
    const dayNumber = (c.week - 1) * 7 + plan.dayNumber;
    let state: DayState | null = null;
    const holdsKind = !!c.kindDays && plan.detailedSteps.some((step) => step.kind === c.kindDays!.kind);
    if (!plan.isRestDay) {
      if (plan.isTestDay) state = c.testDay;
      else if (holdsKind && kindLeft > 0) {
        state = c.kindDays!.state;
        kindLeft--;
      } else if (plan.isKeySession && c.key) state = c.key;
      else state = queue.shift() ?? c.fill;
    }
    const completed = state === 'done' || state === 'minimum';
    return {
      id: `${goalId}-d${dayNumber}`,
      goalId,
      weekNumber: c.week,
      dayNumber,
      date: plan.date,
      dayOfWeek: plan.dayOfWeek,
      title: plan.title,
      detailedSteps: JSON.stringify(plan.detailedSteps),
      implementationIntention: plan.implementationIntention,
      durationMinutes: plan.durationMinutes,
      slotTime: plan.slotTime,
      isRestDay: plan.isRestDay,
      status: completed ? 'completed' : 'pending',
      completedAt: completed ? new Date(`${plan.date}T19:00:00.000Z`) : null,
      notes: null,
      resourceTitle: null,
      resourceUrl: null,
      resourceType: 'guide',
      resourceWhy: null,
      isKeySession: plan.isKeySession,
      isTestDay: plan.isTestDay,
      whyToday: plan.whyToday || null,
      minimumVersion: (plan.minimumVersion ? JSON.parse(JSON.stringify(plan.minimumVersion)) : null) as never,
      usedMinimumVersion: state === 'minimum',
      notOffered: false,
      created_at: day(START_DATE),
    } as DailyTask;
  });
}

/** The review rows of the case's history weeks. */
export function reviewRows(c: EvalCase): WeeklyReview[] {
  return c.history.map((week) => ({
    id: `${goalIdOf(c)}-r${week.week}`,
    goalId: goalIdOf(c),
    weekNumber: week.week,
    tasksPlanned: week.planned,
    tasksCompleted: week.done,
    scorePercentage: week.planned ? Math.round((100 * week.done) / week.planned) : 0,
    reflection: null,
    aiAdaptationInsight: null,
    created_at: day(START_DATE),
  }));
}

export interface StandInCall {
  model: string;
  method: string;
  args: unknown;
  answered: boolean;
}

type Select = Record<string, unknown>;

/** Prisma's `select` on one row: `true` copies a field, a relation's `{ select, orderBy }` maps its rows. */
function project(row: Record<string, unknown>, select: Select): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, how] of Object.entries(select)) {
    if (how === true) out[key] = row[key];
    else if (how && typeof how === 'object') {
      const relation = how as { select?: Select; orderBy?: Record<string, 'asc' | 'desc'> };
      let rows = [...((row[key] as Record<string, unknown>[]) ?? [])];
      const [field, order] = Object.entries(relation.orderBy ?? {})[0] ?? [];
      if (field) rows.sort((a, b) => ((a[field] as number) - (b[field] as number)) * (order === 'desc' ? -1 : 1));
      out[key] = relation.select ? rows.map((item) => project(item, relation.select!)) : rows;
    }
  }
  return out;
}

/**
 * The in-memory stand-in for `global.prisma`: answers exactly the three reads the update makes, from the case's data,
 * and records every call. Any other call is recorded and throws, so a read the eval did not expect shows in the run.
 */
export function standIn(goal: ClosingGoal, reviews: WeeklyReview[], weekBefore: DailyTask[]): { client: unknown; calls: StandInCall[] } {
  const calls: StandInCall[] = [];
  const answer = (model: string, method: string, args: unknown, value: unknown) => {
    calls.push({ model, method, args, answered: true });
    return Promise.resolve(value);
  };
  const handlers: Record<string, Record<string, (args: any) => Promise<unknown>>> = {
    goal: {
      findFirst: (args) => {
        const where = args?.where ?? {};
        const match = where.userId === goal.userId && where.status === goal.status;
        const row = goal as unknown as Record<string, unknown>;
        return answer('goal', 'findFirst', args, match ? (args?.select ? project(row, args.select) : row) : null);
      },
    },
    weeklyReview: {
      findMany: (args) => {
        const where = args?.where ?? {};
        const weeks: number[] = where.weekNumber?.in ?? [];
        return answer('weeklyReview', 'findMany', args, reviews.filter((row) => row.goalId === where.goalId && weeks.includes(row.weekNumber)));
      },
    },
    dailyTask: {
      findMany: (args) => {
        const where = args?.where ?? {};
        const rows = weekBefore.filter((row) => row.goalId === where.goalId && row.weekNumber === where.weekNumber).sort((a, b) => a.dayNumber - b.dayNumber);
        return answer('dailyTask', 'findMany', args, rows);
      },
    },
  };
  const client = new Proxy(
    {},
    {
      get(_target, model: string) {
        return new Proxy(
          {},
          {
            get(_inner, method: string) {
              const handler = handlers[model]?.[method];
              if (handler) return handler;
              return (args: unknown) => {
                calls.push({ model, method, args, answered: false });
                return Promise.reject(new Error(`stand-in: prisma.${model}.${method} is not answered`));
              };
            },
          }
        );
      },
    }
  );
  return { client, calls };
}
