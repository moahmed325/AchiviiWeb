/**
 * Method-aware recovery RULE-21 (MR-31 (1), MR-32 (5)): after an open gap, the first hard step back gets the easy line,
 * once. The carry planner (`carry.ts`) adds it; a swap keeps it on the right step (B-49, MR-35 (5)). Pure: no
 * database, no clock, no environment.
 */
import { byDate, type CarriedStep } from '../carryForward.js';
import type { DayClassification, Gap } from '../missedSessions.js';
import { followsMethod } from './inOrder.js';
import { actionOf, type RecoveryProfile } from './profile.js';

/** RULE-21, MR-31 (1): put first in the first hard step back after an open gap, once. */
export const EASY_START_LINE = 'First hard session after a few days off: keep the effort easy today.';

/**
 * Weekly update M1.5a (WU-29, WU-35 (2)): first on every hard high-load step of a high-load goal's first week back
 * after a break (`firstWeekBack.ts`). Not RULE-21's line: a step holding it never also gets that line, and nothing that
 * moves or strips RULE-21's line touches it.
 */
export const FIRST_WEEK_BACK_LINE = 'First week back: keep the effort easy today.';

const textOf = (instructions: unknown) => (typeof instructions === 'string' ? instructions : '');
const withFirstLine = (line: string, text: string) => (text.trim() ? `${line}\n${text}` : line);

export const hasFirstWeekBackLine = (step: { instructions?: unknown }) => textOf(step.instructions).startsWith(FIRST_WEEK_BACK_LINE);

/** RULE-21: the easy line goes first, once; the minutes do not change. Never on a step holding the first-week-back line. */
export function withEasyLine(instructions: unknown): string {
  const text = textOf(instructions);
  return text.startsWith(EASY_START_LINE) || text.startsWith(FIRST_WEEK_BACK_LINE) ? text : withFirstLine(EASY_START_LINE, text);
}

/** M1.5a: the first-week-back line goes first, once; the minutes do not change. */
export function withFirstWeekBackLine(instructions: unknown): string {
  const text = textOf(instructions);
  return text.startsWith(FIRST_WEEK_BACK_LINE) ? text : withFirstLine(FIRST_WEEK_BACK_LINE, text);
}

/** A step that a reorder moves leaves RULE-21's line behind: it belongs to the first day back, not to the step. */
export function withoutEasyLine(instructions: unknown): unknown {
  if (typeof instructions !== 'string' || !instructions.startsWith(EASY_START_LINE)) return instructions;
  return instructions.slice(EASY_START_LINE.length).replace(/^\n/, '');
}

export const hasEasyLine = (step: CarriedStep) => textOf(step.instructions).startsWith(EASY_START_LINE);

export interface EasyLineInput {
  days: readonly DayClassification[];
  gap: Gap | null;
  /** The user's local calendar date, 'YYYY-MM-DD'. */
  today: string;
  profile: RecoveryProfile | null | undefined;
}

/**
 * RULE-21's target: the first hard step on the first open practice day of today's week after the gap that has a hard
 * step and follows the new rules, read from `rowOf`. When the test day is the first open practice day back, its hard
 * test step counts; a later test day is skipped. Null without a gap or without such a step.
 */
export function easyLineTarget(input: EasyLineInput, rowOf: (taskId: string) => readonly CarriedStep[]): { day: DayClassification; index: number } | null {
  const { gap, profile } = input;
  const ordered = [...input.days].sort(byDate);
  const todayDay = ordered.find((day) => day.date === input.today);
  if (!gap || !todayDay) return null;
  const openBack = ordered.filter(
    (day) => day.weekNumber === todayDay.weekNumber && day.date > gap.lastDate && day.date >= input.today && day.kind === 'planned'
  );
  const backDays = openBack.filter((day, index) => !day.isTestDay || index === 0);
  const isTestStep = (step: CarriedStep) => step.priority === 0 || /^weekly test\b/i.test(textOf(step.title));
  for (const day of backDays) {
    const row = rowOf(day.taskId);
    if (!followsMethod(row, profile)) continue;
    const index = row.findIndex((step) => actionOf(step, profile)!.hard && (!day.isTestDay || isTestStep(step)));
    if (index >= 0) return { day, index };
  }
  return null;
}

/**
 * B-49 (MR-35 (5)): after a swap of `swapped`, RULE-21's line is on its target, once. `before` and `after` are each
 * day's steps before and after the swap. When neither swapped day held the line before nor holds the target after, or
 * there is no open gap, nothing changes. Otherwise the target starts with the line and every other step on an open day
 * of today's week (today or later) loses it. Returns only the rows that change, by task id.
 */
export function easyLineAfterSwap(
  input: EasyLineInput & {
    swapped: readonly [string, string];
    before: ReadonlyMap<string, readonly CarriedStep[]>;
    after: ReadonlyMap<string, readonly CarriedStep[]>;
  }
): Map<string, CarriedStep[]> {
  const changes = new Map<string, CarriedStep[]>();
  if (!input.gap || !input.profile) return changes;
  const rowOf = (taskId: string) => input.after.get(taskId) ?? [];
  const target = easyLineTarget(input, rowOf);
  const heldLine = input.swapped.some((taskId) => (input.before.get(taskId) ?? []).some(hasEasyLine));
  if (!heldLine && !(target && input.swapped.includes(target.day.taskId))) return changes;

  const todayDay = input.days.find((day) => day.date === input.today);
  const open = input.days.filter((day) => day.weekNumber === todayDay?.weekNumber && day.date >= input.today && day.kind === 'planned');
  for (const day of open) {
    const row = rowOf(day.taskId);
    let changed = false;
    const next = row.map((step, index) => {
      const isTarget = target?.day.taskId === day.taskId && target.index === index;
      const instructions = isTarget ? withEasyLine(step.instructions) : withoutEasyLine(step.instructions);
      if (instructions === step.instructions) return step;
      changed = true;
      return { ...step, instructions } as CarriedStep;
    });
    if (changed) changes.set(day.taskId, next);
  }
  return changes;
}
