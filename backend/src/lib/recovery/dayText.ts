/**
 * Method-aware recovery, M3.1d review: a day describes its step. When code puts a different step at priority 1 on a
 * day (a reorder, a handoff placement, or a session giving its step up), the day's title, 10-minute version and
 * implementation intention follow the new step, and a "why today" that names the old step is cleared. Pure. Used only
 * with `METHOD_RECOVERY_ENABLED` on (`placeHandoff`, `writeRecovery`).
 */
import type { DetailedStep } from '../ai/goalDecomposer.js';
import type { CarriedStep } from '../carryForward.js';
import { asWritten } from './carry.js';
import { withoutLoad } from '../safety/stepLoad.js';

/** As `weekPlan.ts`'s fallback: the 10-minute version is at most this long. */
const MINIMUM_VERSION_MINUTES = 10;

export interface DayText {
  title?: string | null;
  minimumVersion?: unknown;
  implementationIntention?: string | null;
  whyToday?: string | null;
}

export interface NewDayText {
  title: string;
  minimumVersion: DetailedStep;
  /** Present only when the day had one to rewrite. */
  implementationIntention?: string;
  /** '' when the old "why today" named the old step (cleared); absent when it is kept. */
  whyToday?: string;
}

const lead = (steps: readonly CarriedStep[]) => steps.find((step) => step.priority === 1);
const replaceAll = (text: string, from: string, to: string) => (from ? text.split(from).join(to) : text);

/**
 * The day's new text when its priority-1 step is not the one it had (by title), or null when it is the same. The
 * 10-minute version is `weekPlan.ts`'s fallback: the step itself as written, titled "Short version: {title}", at most
 * 10 minutes, with the step's kind (MR-15) and without its load (plan safety limits M2.1).
 */
export function describeDay(day: DayText, before: readonly CarriedStep[], after: readonly CarriedStep[]): NewDayText | null {
  const old = lead(before);
  const now = lead(after);
  if (!now || (old && old.title === now.title)) return null;

  // Plan safety limits M2.1 (M1.1 section 3): the full step's load is not the 10-minute version's.
  const { priority: _priority, ...content } = withoutLoad(asWritten(now));
  const minutes = content.durationMinutes > 0 && content.durationMinutes <= MINIMUM_VERSION_MINUTES ? content.durationMinutes : MINIMUM_VERSION_MINUTES;
  const out: NewDayText = {
    title: now.title,
    minimumVersion: { ...content, stepNumber: 1, title: `Short version: ${now.title}`, durationMinutes: minutes },
  };
  if (typeof day.implementationIntention === 'string' && day.implementationIntention) {
    // The intention is written as "At {time}: {day title}."; the old step's title can appear in it too.
    let text = replaceAll(day.implementationIntention, typeof day.title === 'string' ? day.title : '', now.title);
    if (old) text = replaceAll(text, old.title, now.title);
    if (text !== day.implementationIntention) out.implementationIntention = text;
  }
  if (old && typeof day.whyToday === 'string' && day.whyToday.toLowerCase().includes(old.title.toLowerCase())) out.whyToday = '';
  return out;
}
