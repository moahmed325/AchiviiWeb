/**
 * Weekly update M1.5a (WU-29 (1), WU-35 (2)): a high-load goal's first week back after a break. After the week call,
 * every step that is hard in the profile and high-load starts with the first-week-back line, once. Pure: no database,
 * no clock, no environment. Minutes don't change; the 10-minute version and rest days are left alone; the stored
 * target is never touched.
 */
import type { DetailedStep } from '../ai/goalDecomposer.js';
import type { WeekDayPlan } from '../ai/weekPlan.js';
import { withFirstWeekBackLine } from './easyStart.js';
import { actionOf, type RecoveryProfile } from './profile.js';

/**
 * High-load as the week call's safety check reads it (a step of an `isHighLoadGoal` goal, or a step flagged `highLoad`),
 * plus a step whose kind is high-load. Hard as the profile says (`actionOf`); with no readable profile every high-load
 * step counts, since nothing says which are hard.
 */
export function takesFirstWeekBackLine(step: DetailedStep, profile: RecoveryProfile | null | undefined, highLoadGoal: boolean): boolean {
  const kind = profile?.kinds?.find((item) => item.id === step.kind);
  const highLoad = highLoadGoal || step.highLoad === true || kind?.highLoad === true;
  if (!highLoad) return false;
  if (!profile) return true;
  return actionOf(step, profile)?.hard === true;
}

/** The week with the line first on every step that takes it, once. Days that don't change are returned as they were. */
export function withFirstWeekBackLines(days: WeekDayPlan[], profile: RecoveryProfile | null | undefined, highLoadGoal: boolean): WeekDayPlan[] {
  return days.map((day) => {
    if (day.isRestDay) return day;
    let changed = false;
    const detailedSteps = day.detailedSteps.map((step) => {
      if (!takesFirstWeekBackLine(step, profile, highLoadGoal)) return step;
      const instructions = withFirstWeekBackLine(step.instructions);
      if (instructions === step.instructions) return step;
      changed = true;
      return { ...step, instructions };
    });
    return changed ? { ...day, detailedSteps } : day;
  });
}
