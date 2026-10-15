/**
 * Method-aware recovery: the step checks the carry planner (`carry.ts`) and the swap check (`swap.ts`) share, so both
 * read RULE-7, RULE-12 and RULE-14 the same way (M3.2). Pure: no database, no clock, no environment.
 */
import type { CarriedStep, ContinueMarker, ShiftMarker } from '../carryForward.js';
import { isHighLoadStep } from '../highLoad.js';
import type { DayClassification } from '../missedSessions.js';
import { actionOf, type RecoveryProfile } from './profile.js';

/** The goal text `isHighLoadStep` reads. */
export type GoalText = { rawGoal: string; clarifiedOutcome: string };

/** A 'YYYY-MM-DD' date as a whole day count, for calendar-day distances. */
export const dayNumberOf = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/**
 * RULE-14: hard by the step's kind (high-load included, RULE-7), or for a step without a known kind by today's test
 * (MR-29 (2)).
 */
export function isHardStep(step: CarriedStep, profile: RecoveryProfile | null | undefined, goal: GoalText): boolean {
  const recovery = actionOf(step, profile);
  return recovery ? recovery.hard : isHighLoadStep(step, goal);
}

/** RULE-12 (MR-17): a step whose action is fixed (the test step, a fixed-time session, or a kind the profile fixes). */
export const isFixedStep = (step: CarriedStep, profile: RecoveryProfile | null | undefined) => actionOf(step, profile)?.action === 'fixed';

/** RULE-14 (MR-29 (2)): only strain that happened or can still happen counts: done days and open days. */
export const countsForRest = (day: Pick<DayClassification, 'kind'>) => day.kind === 'done' || day.kind === 'planned';

/** The step's `continueFrom` marker (RULE-10), or null. */
export function continueMarkerOf(step: CarriedStep): ContinueMarker | null {
  const marker = step.continueFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}

/** The step's `shiftedFrom` marker (RULE-20), or null. */
export function shiftMarkerOf(step: CarriedStep): ShiftMarker | null {
  const marker = step.shiftedFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}
