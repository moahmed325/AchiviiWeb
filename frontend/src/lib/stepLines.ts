import type { DailyTask, DetailedStep } from '../types';
import { parseSteps, weekdayOf } from './today';

/*
 * Method-aware recovery M3.3: the lines the server puts first in a step's instructions, each followed by a newline
 * (backend `recovery/carry.ts`), and the continue line built on screen from the step's `continueFrom` marker (RULE-10).
 * The stored text is never changed; screens show each of these lines on its own line above the rest.
 */

/** RULE-21, MR-31 (1): the first hard step back after a break. Always first when present. */
export const EASY_START_LINE = 'First hard session after a few days off: keep the effort easy today.';

/** MR-26, MR-31 (2): a moved physical step. After the easy line when both are there. */
export const MOVED_WARM_UP_LINE = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

/**
 * Weekly update M1.5a (WU-35 (2)): a high-load goal's hard steps in the first week back after a break. Never on a step
 * with the easy line; before the warm-up line when both are there.
 */
export const FIRST_WEEK_BACK_LINE = 'First week back: keep the effort easy today.';

const STORED_LEADS = [EASY_START_LINE, FIRST_WEEK_BACK_LINE, MOVED_WARM_UP_LINE];

export interface StepLines {
  /** The lines shown first, each on its own line: the continue line, then the stored easy (or first-week-back) and warm-up lines. */
  lead: string[];
  /** The rest of the instructions, as stored. */
  body: string;
}

/** The parts of a step these lines read. */
export interface StepText {
  instructions?: unknown;
  continueFrom?: { taskId?: unknown; date?: unknown } | null;
}

/** The markers that say where a step came from. */
interface CameFrom {
  title?: unknown;
  shiftedFrom?: { taskId?: unknown; date?: unknown } | null;
  carriedFrom?: { taskId?: unknown; date?: unknown } | null;
  swappedFrom?: unknown;
}

/**
 * B-55: the days that are done, by id, each with the identities (`stepKey`) of the steps it holds. Built once from the
 * goal's days (`doneDaysOf`) and passed wherever the screen asks about a done day.
 */
export type DoneDays = ReadonlyMap<string, ReadonlySet<string>>;

const markerDay = (marker: unknown): string | null => {
  if (!marker || typeof marker !== 'object') return null;
  const { taskId, date } = marker as { taskId?: unknown; date?: unknown };
  return typeof taskId === 'string' && typeof date === 'string' ? taskId : null;
};

/**
 * A step's identity, as backend `originOf` and `stepKey` (`recovery/inOrder.ts`) build it: the day it was written on
 * (its `shiftedFrom`, else `carriedFrom`, else `swappedFrom` marker's day, else the day holding it) plus its title.
 */
export function stepKey(step: CameFrom, dayId: string): string {
  const origin = markerDay(step.shiftedFrom) ?? markerDay(step.carriedFrom) ?? markerDay(step.swappedFrom) ?? dayId;
  return `${origin}\u0000${typeof step.title === 'string' ? step.title : ''}`;
}

/** The completed days and the steps each holds as stored (B-55). */
export function doneDaysOf(tasks: readonly Pick<DailyTask, 'id' | 'status' | 'detailedSteps' | 'notOffered'>[] | null | undefined): DoneDays {
  const done = new Map<string, Set<string>>();
  for (const task of tasks ?? []) {
    // Weekly update M1.4: a day not offered is never done, as the backend never classifies it done (`classifyDays`).
    if (task.status !== 'completed' || task.notOffered) continue;
    done.set(task.id, new Set((parseSteps(task.detailedSteps) as CameFrom[]).map((step) => stepKey(step, task.id))));
  }
  return done;
}

/**
 * B-50 (MR-36): a reorder's copy (`shiftedFrom`); B-52 (MR-37): a moved step (`carriedFrom`), in every switch state.
 * B-55: ignored only when a day its markers name is done and still holds that same step (same `stepKey`); a session
 * that gave its step up and was then done with its other steps does not make that step done. Mirrors backend
 * `isDoneCopy` (`recovery/inOrder.ts`); keep the two the same.
 */
export function fromDoneDay(step: CameFrom, dayId: string, done: DoneDays): boolean {
  const key = stepKey(step, dayId);
  return [step.shiftedFrom?.taskId, step.carriedFrom?.taskId].some((from) => typeof from === 'string' && done.get(from)?.has(key) === true);
}

/**
 * The steps shown on day `dayId`: a step from a done day (`fromDoneDay`) is not shown, but the day's only steps stay
 * (MR-33 (2): a day is never left empty). Nothing stored changes.
 */
export function visibleSteps<T extends CameFrom>(steps: T[], dayId: string, done: DoneDays): T[] {
  const kept = steps.filter((step) => !fromDoneDay(step, dayId, done));
  return kept.length > 0 ? kept : steps;
}

/** The day fields `visibleDay` reads and may change. */
type DayFields = Pick<DailyTask, 'id' | 'title' | 'detailedSteps' | 'durationMinutes' | 'implementationIntention'> &
  Partial<Pick<DailyTask, 'minimumVersion' | 'whyToday'>>;

/** A step as stored, with the fields the backend adds inside `detailedSteps`. */
type StoredStep = DetailedStep & CameFrom & { priority?: number; swappedFrom?: unknown; toNextWeek?: unknown };

/** As backend `recovery/dayText.ts`: the 10-minute version is at most this long. */
const MINIMUM_VERSION_MINUTES = 10;

const replaceAll = (text: string, from: string, to: string) => (from ? text.split(from).join(to) : text);

/**
 * The day as the person sees it (B-52, Mo's option B): the steps `visibleSteps` keeps, the stored minutes less the
 * hidden steps' minutes, and, only when a hidden step was the day's priority-1 step, the title, 10-minute version,
 * intention and "why today" rebuilt from the step that leads now, the way backend `describeDay` does it ("Short
 * version: {title}", at most 10 minutes, its kind; the old titles replaced in the intention; a "why today" naming the
 * old step cleared). Otherwise the stored text is kept. Screen only: nothing stored changes, and actions still send
 * the day as stored.
 */
export function visibleDay<T extends DayFields>(task: T, done: DoneDays): T & { steps: DetailedStep[] } {
  const stored = parseSteps(task.detailedSteps) as StoredStep[];
  const steps = visibleSteps(stored, task.id, done);
  if (steps.length === stored.length) return { ...task, steps };

  const hidden = stored.filter((step) => !steps.includes(step));
  const hiddenMinutes = hidden.reduce((sum, step) => sum + Math.max(0, step.durationMinutes || 0), 0);
  const durationMinutes = task.durationMinutes > 0 ? Math.max(0, task.durationMinutes - hiddenMinutes) : task.durationMinutes;
  const day = { ...task, steps, durationMinutes };

  const old = hidden.find((step) => step.priority === 1);
  if (!old) return day;
  // The step a renumber would put first: the lowest priority above 0, else the first step shown.
  const ranked = steps.filter((step) => typeof step.priority === 'number' && step.priority > 0).sort((a, b) => a.priority! - b.priority!);
  const now = ranked[0] ?? steps[0];
  if (now.title === old.title) return day;

  // The step as written (backend `asWritten`), without its priority.
  const content: StoredStep = { ...now };
  for (const key of ['priority', 'carriedFrom', 'shiftedFrom', 'continueFrom', 'swappedFrom', 'toNextWeek'] as const) delete content[key];
  const minutes = content.durationMinutes > 0 && content.durationMinutes <= MINIMUM_VERSION_MINUTES ? content.durationMinutes : MINIMUM_VERSION_MINUTES;
  const minimumVersion: DetailedStep = { ...content, stepNumber: 1, title: `Short version: ${now.title}`, durationMinutes: minutes };
  let implementationIntention = task.implementationIntention;
  if (typeof implementationIntention === 'string' && implementationIntention) {
    implementationIntention = replaceAll(replaceAll(implementationIntention, task.title ?? '', now.title), old.title, now.title);
  }
  const namesOld = typeof task.whyToday === 'string' && task.whyToday.toLowerCase().includes(old.title.toLowerCase());
  return { ...day, title: now.title, minimumVersion, implementationIntention, whyToday: namesOld ? '' : task.whyToday };
}

/**
 * The continue line for a step marked by RULE-10, or null. B-50 (Mo): when the day the marker names is done, the work
 * was picked up there, so the marker is ignored (it stays stored).
 */
export function continueLine(step: StepText, done: DoneDays = new Map()): string | null {
  const from = step.continueFrom?.taskId;
  if (typeof from === 'string' && done.has(from)) return null;
  const date = step.continueFrom?.date;
  const weekday = typeof date === 'string' ? weekdayOf(date) : null;
  return weekday ? `Pick up where ${weekday} stopped.` : null;
}

export function stepLines(step: StepText, done?: DoneDays): StepLines {
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
