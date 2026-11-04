/**
 * I-30: does missed-session recovery work? A read-only measure over stored goals, run by hand
 * (`npm run report:recovery`, `scripts/recovery-report.ts`). Pure: the goals and `now` are passed in.
 *
 * Four questions, each split into pathway and custom goals:
 * 1. Moved steps: of the closed practice days holding a step that recovery moved there (carried, swapped in, picked
 *    up where a missed day stopped, or moved in order, next week included), how many were done, against ordinary days.
 * 2. Coming back: after a missed practice day, was the next closed practice day done?
 * 3. Breaks: in the first week back after a break, how many of its closed practice days were done, and how many
 *    people did at least one.
 * 4. Still going: of the goals whose plan has reached week N on the calendar, how many did a practice day in week N
 *    or later; also split by whether week 1 had a missed day.
 *
 * Completion is stored per day, so a day holding a moved step counts as done when the day is done (the 10-minute
 * version included, as everywhere else, RULE-4).
 */
import { classifyDays, type DayKind } from '../missedSessions.js';
import { parseStoredSteps, type CarriedStep } from '../carryForward.js';
import { readRoutine } from '../planV2.js';
import { shapeOf } from '../planLength.js';

export interface ReportTask {
  id: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  isRestDay: boolean;
  isKeySession: boolean;
  isTestDay: boolean;
  notOffered: boolean;
  usedMinimumVersion: boolean;
  detailedSteps: string;
}

export interface ReportGoal {
  id: string;
  isGoldenRail: boolean;
  status: string;
  startDate: Date;
  totalWeeks: number | null;
  routine: string;
  user: { timezone: string | null };
  dailyTasks: ReportTask[];
  roadmapWeeks: { weekNumber: number; breakDays: number | null; jumped: boolean }[];
}

/** How recovery moved a step onto a day. */
export type MoveKind = 'carried' | 'swapped' | 'continued' | 'in_order';
export const MOVE_KINDS: readonly MoveKind[] = ['carried', 'swapped', 'continued', 'in_order'];

/** A count and how many of it were done. */
export interface Share {
  total: number;
  done: number;
}

export interface GroupReport {
  goals: number;
  /** Closed practice days with no moved step. */
  ordinaryDays: Share;
  /** Closed practice days holding a moved step, by how it was moved (a day holding two kinds counts in each). */
  movedDays: Record<MoveKind, Share>;
  /** Closed practice days holding any moved step. */
  anyMovedDays: Share;
  /** Missed practice days followed by a closed practice day; done = that next day was done. */
  comeback: Share;
  /** Closed practice days in a first week back after a break. */
  firstWeekBackDays: Share;
  /** Goals with a first week back that has closed practice days; done = at least one was done. */
  firstWeekBackGoals: Share;
  /** By week N: goals whose plan has reached week N; done = did a practice day in week N or later. */
  stillGoing: Record<number, Share>;
  /** The same, for goals whose week 1 had a missed practice day. */
  stillGoingAfterEarlyMiss: Record<number, Share>;
  /** The same, for goals whose week 1 had none. */
  stillGoingNoEarlyMiss: Record<number, Share>;
}

export interface RecoveryReport {
  all: GroupReport;
  pathway: GroupReport;
  custom: GroupReport;
}

/** The weeks "still going" is measured at. */
export const CHECK_WEEKS: readonly number[] = [2, 4, 8, 12];

const DAY_MS = 86_400_000;

const share = (): Share => ({ total: 0, done: 0 });
const weekShares = () => Object.fromEntries(CHECK_WEEKS.map((week) => [week, share()])) as Record<number, Share>;
const count = (into: Share, done: boolean) => {
  into.total += 1;
  if (done) into.done += 1;
};

function emptyGroup(): GroupReport {
  return {
    goals: 0,
    ordinaryDays: share(),
    movedDays: { carried: share(), swapped: share(), continued: share(), in_order: share() },
    anyMovedDays: share(),
    comeback: share(),
    firstWeekBackDays: share(),
    firstWeekBackGoals: share(),
    stillGoing: weekShares(),
    stillGoingAfterEarlyMiss: weekShares(),
    stillGoingNoEarlyMiss: weekShares(),
  };
}

/** The ways recovery moved a step onto this day, read from the markers on its stored steps. */
export function moveKindsOf(steps: readonly CarriedStep[]): Set<MoveKind> {
  const kinds = new Set<MoveKind>();
  for (const step of steps) {
    if (step.carriedFrom) kinds.add('carried');
    if (step.swappedFrom) kinds.add('swapped');
    if (step.continueFrom) kinds.add('continued');
    if (step.shiftedFrom) kinds.add('in_order');
  }
  return kinds;
}

function addGoal(group: GroupReport, goal: ReportGoal, now: Date): void {
  group.goals += 1;
  const routine = readRoutine(goal);
  const classified = classifyDays(goal.dailyTasks, { now, timezone: goal.user.timezone, sleepTime: routine.sleepTime });
  const kindOf = new Map<string, DayKind>(classified.map((day) => [day.taskId, day.kind]));
  const practice = [...goal.dailyTasks]
    .filter((task) => {
      const kind = kindOf.get(task.id);
      return kind === 'done' || kind === 'missed';
    })
    .sort((a, b) => (a.date === b.date ? a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1));

  // 1. Moved steps against ordinary days.
  for (const task of practice) {
    const done = kindOf.get(task.id) === 'done';
    const kinds = moveKindsOf(parseStoredSteps(task.detailedSteps));
    if (kinds.size === 0) {
      count(group.ordinaryDays, done);
      continue;
    }
    count(group.anyMovedDays, done);
    for (const kind of kinds) count(group.movedDays[kind], done);
  }

  // 2. The closed practice day after each missed one.
  for (let index = 0; index < practice.length - 1; index += 1) {
    if (kindOf.get(practice[index].id) === 'missed') count(group.comeback, kindOf.get(practice[index + 1].id) === 'done');
  }

  // 3. First weeks back after a break.
  for (const week of goal.roadmapWeeks) {
    if (week.breakDays === null || week.jumped) continue;
    const days = practice.filter((task) => task.weekNumber === week.weekNumber);
    if (days.length === 0) continue;
    const done = days.filter((task) => kindOf.get(task.id) === 'done').length;
    group.firstWeekBackDays.total += days.length;
    group.firstWeekBackDays.done += done;
    count(group.firstWeekBackGoals, done > 0);
  }

  // 4. Still going at week N, on the calendar (a person who stops opening the app gets no later week written).
  const weeks = shapeOf(goal).weeks;
  const earlyMiss = practice.some((task) => task.weekNumber === 1 && kindOf.get(task.id) === 'missed');
  for (const week of CHECK_WEEKS) {
    if (week > weeks) continue;
    const reachedAt = goal.startDate.getTime() + (week - 1) * 7 * DAY_MS;
    if (Number.isNaN(reachedAt) || reachedAt > now.getTime()) continue;
    const going = goal.dailyTasks.some((task) => task.weekNumber >= week && kindOf.get(task.id) === 'done');
    count(group.stillGoing[week], going);
    count((earlyMiss ? group.stillGoingAfterEarlyMiss : group.stillGoingNoEarlyMiss)[week], going);
  }
}

export function recoveryReport(goals: readonly ReportGoal[], now: Date): RecoveryReport {
  const report: RecoveryReport = { all: emptyGroup(), pathway: emptyGroup(), custom: emptyGroup() };
  for (const goal of goals) {
    addGoal(report.all, goal, now);
    addGoal(goal.isGoldenRail ? report.pathway : report.custom, goal, now);
  }
  return report;
}

const percent = ({ total, done }: Share) => (total === 0 ? '—' : `${Math.round((done / total) * 100)}%`);
const line = (label: string, value: Share, unit: string) => `  ${label.padEnd(44)} ${percent(value).padStart(4)}  (${value.done} of ${value.total} ${unit})`;

const MOVE_WORDS: Record<MoveKind, string> = {
  carried: 'Carried to another day',
  swapped: 'Swapped in',
  continued: 'Picked up where a missed day stopped',
  in_order: 'Moved in order (next week too)',
};

/** The report as plain text, one block per group. */
export function formatRecoveryReport(report: RecoveryReport): string {
  const block = (title: string, group: GroupReport) => [
    `${title}: ${group.goals} goal${group.goals === 1 ? '' : 's'}`,
    '',
    ' Days done',
    line('Ordinary practice days', group.ordinaryDays, 'days'),
    line('Days holding a moved step', group.anyMovedDays, 'days'),
    ...MOVE_KINDS.map((kind) => line(`  ${MOVE_WORDS[kind]}`, group.movedDays[kind], 'days')),
    '',
    ' Coming back',
    line('Next practice day done after a missed day', group.comeback, 'misses'),
    '',
    ' After a break',
    line('First week back: days done', group.firstWeekBackDays, 'days'),
    line('First week back: did at least one day', group.firstWeekBackGoals, 'people'),
    '',
    ' Still practising at week N (of goals that reached it)',
    ...CHECK_WEEKS.map((week) => line(`Week ${week}`, group.stillGoing[week], 'goals')),
    ...CHECK_WEEKS.map((week) => line(`Week ${week}, missed a day in week 1`, group.stillGoingAfterEarlyMiss[week], 'goals')),
    ...CHECK_WEEKS.map((week) => line(`Week ${week}, no miss in week 1`, group.stillGoingNoEarlyMiss[week], 'goals')),
  ];
  return [...block('All goals', report.all), '', ...block('Pathway goals', report.pathway), '', ...block('Custom goals', report.custom)].join('\n');
}
