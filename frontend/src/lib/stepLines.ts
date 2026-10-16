import { weekdayOf } from './today';

/*
 * Method-aware recovery M3.3: the lines the server puts first in a step's instructions, each followed by a newline
 * (backend `recovery/carry.ts`), and the continue line built on screen from the step's `continueFrom` marker (RULE-10).
 * The stored text is never changed; screens show each of these lines on its own line above the rest.
 */

/** RULE-21, MR-31 (1): the first hard step back after a break. Always first when present. */
export const EASY_START_LINE = 'First hard session after a few days off: keep the effort easy today.';

/** MR-26, MR-31 (2): a moved physical step. After the easy line when both are there. */
export const MOVED_WARM_UP_LINE = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

const STORED_LEADS = [EASY_START_LINE, MOVED_WARM_UP_LINE];

export interface StepLines {
  /** The lines shown first, each on its own line: the continue line, then the stored easy and warm-up lines. */
  lead: string[];
  /** The rest of the instructions, as stored. */
  body: string;
}

/** The parts of a step these lines read. */
export interface StepText {
  instructions?: unknown;
  continueFrom?: { taskId?: unknown; date?: unknown } | null;
}

/** The ids of the days that are done, for `continueLine`. */
export function doneTaskIds(tasks: readonly { id: string; status?: string | null }[] | null | undefined): ReadonlySet<string> {
  return new Set((tasks ?? []).filter((task) => task.status === 'completed').map((task) => task.id));
}

/**
 * B-50 (Mo): a reorder's copy (`shiftedFrom`) whose day is done was done there, so it is not shown; the day's only
 * step stays (MR-33 (2): a day is never left empty). Nothing stored changes.
 */
export function withoutDoneCopies<T extends { shiftedFrom?: { taskId?: unknown } | null }>(steps: T[], done: ReadonlySet<string>): T[] {
  const kept = steps.filter((step) => {
    const from = step.shiftedFrom?.taskId;
    return !(typeof from === 'string' && done.has(from));
  });
  return kept.length > 0 ? kept : steps;
}

/**
 * The continue line for a step marked by RULE-10, or null. B-50 (Mo): when the day the marker names is done, the work
 * was picked up there, so the marker is ignored (it stays stored).
 */
export function continueLine(step: StepText, done: ReadonlySet<string> = new Set()): string | null {
  const from = step.continueFrom?.taskId;
  if (typeof from === 'string' && done.has(from)) return null;
  const date = step.continueFrom?.date;
  const weekday = typeof date === 'string' ? weekdayOf(date) : null;
  return weekday ? `Pick up where ${weekday} stopped.` : null;
}

export function stepLines(step: StepText, done?: ReadonlySet<string>): StepLines {
  const lead: string[] = [];
  const pickUp = continueLine(step, done);
  if (pickUp) lead.push(pickUp);
  let body = typeof step.instructions === 'string' ? step.instructions : '';
  for (const line of STORED_LEADS) {
    if (body === line || body.startsWith(`${line}\n`)) {
      lead.push(line);
      body = body.slice(line.length + 1);
    }
  }
  return { lead, body };
}
